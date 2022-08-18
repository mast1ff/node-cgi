import { Cookies } from "./Cookies";
import { Headers } from "./Headers";
import { Session } from "./Session";

export class Response {
  public isHeadersSent = false;
  public headers: Headers;
  public session: Session;

  constructor(headers: Headers, session: Session) {
    this.headers = headers;
    this.session = session;
    this.sendHeaders = this.sendHeaders.bind(this);
    this.write = this.write.bind(this);
    this.end = this.end.bind(this);
  }

  public sendHeaders() {
    if (this.isHeadersSent) return;
    this.isHeadersSent = true;
    process.stdout.write(`Content-Type:text/html;charset=utf-8\n`);
    for (const [key, values] of Object.entries(this.headers.raw())) {
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

  public write(text: string | Buffer) {
    this.sendHeaders();
    process.stdout.write(text.toString());
  }

  public end() {
    this.sendHeaders();
    process.exit();
  }
}
