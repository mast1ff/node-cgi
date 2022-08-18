import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs";
import * as vm from "node:vm";
import * as ejs from "ejs";
import { Config } from "./Config";
import { Cookies } from "./Cookies";
import { Headers } from "./Headers";
import { Request, RequestPost } from "./Request";
import { Response } from "./Response";
import { Session } from "./Session";

export class Context {
  public request: Request;
  public response: Response;
  public headers: Headers;
  public server: Headers;
  public cookies: Cookies;
  public session: Session;
  public url: url.URL;
  public query: url.URLSearchParams;
  public post: Pick<RequestPost, "files" | "form" | "parts">;
  public ejs = ejs;

  public httpVersion: string;

  constructor() {
    const env = process.env;
    const headers = new Headers();
    const server = new Headers();
    for (const name in env) {
      const value = env[name];
      const lName = name.toLowerCase();

      if (typeof value !== "undefined") {
        if (lName.indexOf("http_") === 0) {
          headers.set(lName.substr("http_".length), value);
        } else {
          server.set(name, value);
        }
      }
    }
    this.headers = headers;
    this.server = server;
    this.httpVersion = this.server.get("server_protocol")!;
    this.headers.set("content_type", this.server.get("content_type") || "");
    this.headers.set("content_length", this.server.get("content_length") || "");

    this.cookies = new Cookies(this.headers.get("cookie"));
    this.session = new Session({ cookies: this.cookies, server: this.server });

    // url
    const protocol = this.server.get("request_scheme")!;
    const host = this.server.get("server_name")!;
    const base = `${protocol}://${host}`;
    this.url = new url.URL(this.server.get("request_uri")!, base);
    this.query = new url.URLSearchParams(this.url.pathname);

    this.request = new Request(this.url.href, {
      method: this.server.get("request_method") || "get",
      headers: this.headers
    });
    this.response = new Response(this.headers, this.session);
    this.post = {
      form: this.request.post.form,
      files: this.request.post.files,
      parts: this.request.post.parts
    };

    //
    this.write = this.write.bind(this);
    this.include = this.include.bind(this);
    this.info = this.info.bind(this);
  }

  public write(text: string | Buffer) {
    return this.response.write(text);
  }

  public include(filePath: string) {
    const file = path.resolve(path.dirname(this.server.get("path_translated")!), filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    let code = "";
    if (path.extname(filePath) != ".js") {
      code = `ejs.render(\`${content}\`)`;
    } else {
      code = content;
    }

    const vmContext = vm.createContext(this);
    vm.runInContext(code, vmContext, file);
  }

  public info() {
    this.response.write(
      "<style>.Logo{ text-align: left; font-size: 36px !important; } .NodeASPTable{ font-family: arial; font-size: 12px; margin: auto; border-collapse: collapse; width: 600px} .NodeASPTable TH{ background-color: #303030; color: white; font-size: 14px; padding: 10px} .NodeASPTable TD{ padding: 5px; } .NodeASPTable TR TD:nth-child(1){ background: #d9ebb3; }</style>"
    );
    this.response.write('<table class="NodeASPTable" border="1">');
    this.response.write(`<tr><th colspan="2" class="Logo">CGI-NODE v${Config.Version}</th></tr>`);

    const session = { id: this.session.id, path: this.session.path, ipAddress: this.session.ipAddress };
    const query = Object.fromEntries(this.query);

    this.drawObject("Node Versions", process.versions);
    this.drawObject("CGI Command Line Arguments", process.argv);
    this.drawObject("Server Variables", Object.fromEntries(this.server));
    this.drawObject("HTTP Request Headers", Object.fromEntries(this.headers));
    this.drawObject("HTTP Request Cookies", this.cookies.data);
    this.drawObject("Session", session);
    this.drawObject("Session Cookies", this.session.cookie);
    this.drawObject("Session Data", this.session.data);
    this.drawObject("URL Query String", query);
    this.drawObject("Post Form", this.post.form);
    this.drawObject("Post Files", this.post.files);
    this.drawObject("Post Parts", this.post.parts);

    this.response.write("</table>");
  }

  private drawObject(title: string, object: any) {
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
