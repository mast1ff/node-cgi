// #!/path/to/node

"use strict";

/**
 * MIT License
 * Copyright (c) 2019-present mast1ff, https://me.mast1ff.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * --- 1 ---
 * To permit this cgi, replace # on the first line above with the
 * appropriate #!/path/to/node shebang, and on Unix / Linux also
 * set this script executable with chmod 755.
 *
 * --- 2 ---
 * Write the absolute path to the directory where the session data
 * will be stored in `process.env.SESSION_PATH`.
 */

process.env.SESSION_PATH = "C:/tmp/node-cgi/sessions";

const url = require("node:url");
const qs = require("node:querystring");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ejs = require("./ejs");

const Config = {
  Version: "0.1.0",
  SessionCookie: "__NODE_SESSION__",
  SessionTimeOut: 15 * 60,
  SessionPath: process.env.SESSION_PATH || "C:/tmp/node-cgi/sessions"
};

/**
 * Cookie
 */
class Cookies {
  store = new Map();

  constructor(cookieHeader) {
    if (!cookieHeader) return;

    const pairs = cookieHeader.split(";");

    for (let index = 0; index < pairs.length; index++) {
      const pair = pairs[index];
      const indexOfEqual = pair.indexOf("=");
      if (indexOfEqual < 0) {
        continue;
      }

      const key = pair.substring(0, indexOfEqual).trim();
      let value = pair.substring(indexOfEqual + 1, pair.length).trim();

      if (value[0] == '"') {
        value = value.slice(1, -1);
      }

      try {
        this.store.set(key, decodeURIComponent(value));
      } catch (err) {
        this.store.set(key, value);
      }
    }
  }

  get(key) {
    return this.store.get(key);
  }

  data() {
    const store = {};
    this.store.forEach((val, key) => {
      store[key] = val;
    });
    return store;
  }

  static serializeCookie(cookie) {
    const pairs = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];

    if (cookie.domain) {
      pairs.push(`Domain=${cookie.domain}`);
    }
    if (cookie.path) {
      pairs.push(`Path=${cookie.path}`);
    }
    if (cookie.expires) {
      pairs.push(`Expires=${cookie.expires.toUTCString()}`);
    }
    if (cookie.httpOnly) {
      pairs.push("HttpOnly");
    }
    if (cookie.sameSite) {
      pairs.push(`SameSite=${cookie.sameSite}`);
    }
    if (cookie.secure) {
      pairs.push("Secure");
    }

    return pairs.join("; ");
  }
}

/**
 * Session
 */
class Session {
  constructor(config) {
    this.config = config;
    this.id = this.config.cookies.get(Config.SessionCookie)
      ? this.config.cookies.get(Config.SessionCookie)
      : this.create();
    this.store = new Map();

    const sessionPath = path.join(Config.SessionPath, this.id);
    if (!fs.existsSync(sessionPath)) {
      this.id = this.create();
    }

    const session = JSON.parse(fs.readFileSync(path.join(Config.SessionPath, this.id), "utf-8"));

    if (session.ipAddress != this.config.server.get("remote_addr")) {
      throw "Invalid session ID";
    }

    this.id = session.id;
    this.cookie = session.cookie;
    this.path = session.path;
    this.ipAddress = session.ipAddress;
    for (const [key, value] of Object.entries(session.data)) {
      this.store.set(key, value);
    }
  }

  create() {
    const date = new Date();
    const idString =
      (this.config.server.get("remote_addr") || "") +
      (this.config.server.get("remote_port") || "") +
      (this.config.server.get("unique_id") || "") +
      date.getTime().toString() +
      Math.random();
    const id = crypto.createHash("md5").update(idString).digest("hex");

    const session = {
      id,
      path: path.join(Config.SessionPath, id),
      ipAddress: this.config.server.get("remote_addr"),
      cookie: {
        name: Config.SessionCookie,
        value: id,
        httpOnly: true,
        notSent: true,
        sameSite: "Lax"
      },
      data: {}
    };

    if (!fs.existsSync(path.join(Config.SessionPath))) {
      fs.mkdirSync(path.join(Config.SessionPath), { recursive: true });
    }
    fs.writeFileSync(session.path, JSON.stringify(session), "utf-8");

    return session.id;
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    return this.store.set(key, value);
  }

  unset(key) {
    return this.store.delete(key);
  }

  data() {
    const data = {};
    this.store.forEach((val, key) => {
      data[key] = val;
    });
    return data;
  }

  save() {
    const session = {
      id: this.id,
      path: this.path,
      ipAddress: this.ipAddress,
      cookie: this.cookie,
      data: this.data()
    };

    fs.writeFileSync(this.path, JSON.stringify(session));
  }

  cleanup() {
    const time = new Date().getTime();
    const timeOut = Config.SessionTimeOut * 1000;

    const sessions = fs.readdirSync(Config.SessionPath);
    for (let index = 0; index < sessions.length; index++) {
      const sessionPath = path.join(Config.SessionPath, sessions[index]);
      const stats = fs.statSync(sessionPath);

      if (stats.mtime.getTime() + timeOut < time) {
        fs.unlinkSync(sessionPath);
      }
    }
  }
}

/**
 * Request
 */
class Request {
  url;
  method;
  headers;

  post = {
    form: {},
    files: [],
    parts: [],
    data: "",
    isMultiPart: false
  };

  constructor(url, init) {
    this.url = url;
    this.method = init.method;
    this.headers = init.headers;

    if (this.headers.get("content_type").toLowerCase().indexOf("multipart/form-data") > -1) {
      this.post.isMultiPart = true;
    }
  }

  readPost(onFinishedRead = () => {}, parseData = true) {
    process.stdin.on("data", (data) => {
      this.post.data += data;
    });
    process.stdin.on("end", () => {
      if (parseData) {
        this.parsePost();
      }
      if (onFinishedRead) onFinishedRead();
    });
  }

  parsePost() {
    if (this.post.isMultiPart) {
      // eslint-disable-next-line
      const dataLength = this.post.data.length;
      let endIndex = 0;
      let startIndex = 0;
      endIndex = this.post.data.indexOf("\n");
      const boundary = this.post.data.substring(startIndex, endIndex - 1);
      startIndex = endIndex + 1;

      const parts = this.post.data.split(boundary);
      for (let index = 0; index < parts.length; index++) {
        //
      }
    } else {
      this.post.form = qs.parse(this.post.data);
    }
  }
}

/**
 * Response
 */
class Response {
  isHeadersSent = false;
  headers;
  session;

  constructor(headers, session) {
    this.headers = headers;
    this.session = session;
    this.sendHeaders = this.sendHeaders.bind(this);
    this.write = this.write.bind(this);
    this.end = this.end.bind(this);
  }

  sendHeaders() {
    if (this.isHeadersSent) return;
    this.isHeadersSent = true;
    process.stdout.write(`Content-Type:text/html;charset=utf-8\n`);
    for (const [key, values] of Object.entries(this.headers)) {
      for (const value of values) {
        process.stdout.write(`${key}:${value}\n`);
      }
    }

    const cookie = this.session.cookie;
    if (cookie.notSent === true) {
      delete cookie.notSent;
      cookie.notSent = false;
      process.stdout.write(`Set-Cookie:${Cookies.serializeCookie(cookie)}\n`);
    }

    process.stdout.write("\n");
  }

  write(text) {
    this.sendHeaders();
    if (text === null) {
      process.stdout.write("NULL");
    } else if (typeof text === "undefined") {
      process.stdout.write("undefined");
    } else if (
      typeof text === "string" ||
      typeof text === "number" ||
      typeof text === "bigint" ||
      typeof text === "boolean"
    ) {
      process.stdout.write(String(text));
    } else {
      process.stdout.write(JSON.stringify(text));
    }
  }

  end() {
    this.sendHeaders();
    process.exit();
  }
}

/**
 * Context
 */
class Context {
  request;
  response;
  headers;
  server;
  cookies;
  session;
  url;
  query;
  ejs = ejs;

  httpVersion;

  constructor() {
    const env = process.env;
    const headers = new Map();
    const server = new Map();
    for (const name in env) {
      const value = env[name];
      const lName = name.toLowerCase();

      if (typeof value !== "undefined") {
        if (lName.indexOf("http_") === 0) {
          headers.set(lName.substr("http_".length), value);
        } else {
          server.set(lName, value);
        }
      }
    }
    this.headers = headers;
    this.server = server;
    this.httpVersion = this.server.get("server_protocol");
    this.headers.set("content_type", this.server.get("content_type") || "");
    this.headers.set("content_length", this.server.get("content_length") || "");

    this.cookies = new Cookies(this.headers.get("cookie"));
    this.session = new Session({ cookies: this.cookies, server: this.server });

    // url
    this.url = url.parse(this.server.get("request_uri"), true);
    this.query = this.url.query;

    this.request = new Request(this.url.pathname, {
      method: this.server.get("request_method") || "get",
      headers: this.headers
    });
    this.response = new Response(this.headers, this.session);

    //
    this.write = this.write.bind(this);
    this.include = this.include.bind(this);
    this.info = this.info.bind(this);
  }

  write(text) {
    return this.response.write(text);
  }

  include(filePath) {
    const file = path.resolve(path.dirname(this.server.get("path_translated")), filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    let code = "";
    if (path.extname(filePath) != ".js") {
      code = `
"use strict";
const result = ejs.render(\`${content}\`, {
  write,
  info,
  include,
  session,
  cookies,
  headers,
  httpVersion,
  url,
  query,
  post: request.post
});
write(result);`;
    } else {
      code = content;
    }

    const vmContext = vm.createContext(this);
    vm.runInContext(code, vmContext, file);
  }

  info() {
    this.response.write(
      `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>`
    );
    this.response.write(
      "<style>.Logo{ text-align: left; font-size: 36px !important; } .NodeASPTable{ font-family: arial; font-size: 12px; margin: auto; border-collapse: collapse; width: 600px; max-width: 100%;} .NodeASPTable TH{ background-color: #303030; color: white; font-size: 14px; padding: 10px} .NodeASPTable TD{ padding: 5px; } .NodeASPTable TR TD:nth-child(1){ background: #d9ebb3; }</style>"
    );
    this.response.write('<table class="NodeASPTable" border="1">');
    this.response.write(`<tr><th colspan="2" class="Logo">@TKNF/NODE_CGI v${Config.Version}</th></tr>`);

    const session = {
      id: this.session.id,
      path: this.session.path,
      ipAddress: this.session.ipAddress
    };

    this.drawObject("Node Versions", process.versions);
    this.drawObject("CGI Command Line Arguments", process.argv);
    this.drawObject("Server Variables", Object.fromEntries(this.server));
    this.drawObject("HTTP Request Headers", Object.fromEntries(this.headers));
    this.drawObject("HTTP Request Cookies", this.cookies.data());
    this.drawObject("Session", session);
    this.drawObject("Session Cookies", this.session.cookie);
    this.drawObject("Session Data", this.session.data());
    this.drawObject("URL Query String", this.query);
    this.drawObject("Post Form", this.request.post.form);
    this.drawObject("Post Files", this.request.post.files);
    this.drawObject("Post Parts", this.request.post.parts);

    this.response.write("</table>");
  }

  drawObject(title, object) {
    this.response.write(`<tr><th colspan="2">${title}</th></tr>`);
    for (const name in object) {
      let value = object[name];
      if (typeof value === "function") {
        continue;
      } else if (typeof value === "object") {
        let htmlValue = `<table class="NodeASPTable" border="0" style="margin: 0;">`;
        for (const subName in value) {
          htmlValue += `<tr><td>${subName}</td><td>${value[subName]}</td></tr>`;
        }
        value = `${htmlValue}</table>`;
      }
      process.stdout.write(`<tr><td>${name}</td><td>${value}</td></tr>`);
    }
  }
}

let context = null;

/**
 * Exec Script
 */
process.on("uncaughtException", (error) => {
  const htmlError = `<br/><div style="color:red"><b>EXCEPTION</b>: ${error.message}<i><pre>${error.stack}</pre></i></div></br>`;
  if (context !== null) {
    context.write(htmlError);
  } else {
    process.stdout.write(`Content-Type: text/html; charset=utf-8\n\n${htmlError}`);
  }
});

process.on("exit", (_code) => {
  context?.session?.save();
  context?.session?.cleanup();
});

context = new Context();

function onReady() {
  context.include(process.env.PATH_TRANSLATED);
}

if (context.request.method.toLowerCase() != "post") {
  onReady();
} else {
  context.request.readPost(onReady);
}
