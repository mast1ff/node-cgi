import * as crypto from "node:crypto";
import * as path from "node:path";
import * as fs from "node:fs";
import { Config } from "./Config";
import { Cookie, Cookies } from "./Cookies";
import { Headers } from "./Headers";

export interface SessionConfig {
  cookies: Cookies;
  server: Headers;
}

export interface SessionCookie extends Cookie {
  notSent?: boolean;
}

export interface SessionData {
  id: string;
  path: string;
  ipAddress: string;
  cookie: SessionCookie;
  data: Record<string, any>;
}

export class Session {
  public id: string;
  public path: string;
  public ipAddress: string;
  public cookie: SessionCookie;
  private store: Map<string, any>;

  constructor(private config: SessionConfig) {
    this.id = this.config.cookies.get(Config.SessionCookie)
      ? this.config.cookies.get(Config.SessionCookie)!
      : this.create();
    this.store = new Map();

    const sessionPath = path.join(Config.SessionPath, this.id);
    if (!fs.existsSync(sessionPath)) {
      this.id = this.create();
    }

    const session = JSON.parse(fs.readFileSync(path.join(Config.SessionPath, this.id), "utf-8")) as SessionData;

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

  private create() {
    const date = new Date();
    const idString =
      (this.config.server.get("remote_addr") || "") +
      (this.config.server.get("remote_port") || "") +
      (this.config.server.get("unique_id") || "") +
      date.getTime().toString() +
      Math.random();
    const id = crypto.createHash("md5").update(idString).digest("hex");

    const session: SessionData = {
      id,
      path: path.join(Config.SessionPath, id),
      ipAddress: this.config.server.get("remote_addr")!,
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

  public get(key: string) {
    return this.store.get(key);
  }

  public set(key: string, value: any) {
    return this.store.set(key, value);
  }

  public unset(key: string) {
    return this.store.delete(key);
  }

  get data() {
    const data: Record<string, any> = {};
    this.store.forEach((val, key) => {
      data[key] = val;
    });
    return data;
  }

  public save() {
    const session: SessionData = {
      id: this.id,
      path: this.path,
      ipAddress: this.ipAddress,
      cookie: this.cookie,
      data: this.data
    };

    fs.writeFileSync(this.path, JSON.stringify(session));
  }

  public cleanup() {
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
