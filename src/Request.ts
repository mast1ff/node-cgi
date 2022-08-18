import * as url from "node:url";
import type { Headers } from "./Headers";

export interface RequestInit {
  method: string;
  headers: Headers;
}

export class FormData extends url.URLSearchParams {}

export interface RequestPost {
  form: FormData;
  files: any[];
  parts: string[];
  data: string;
  isMultiPart: boolean;
}

export class Request {
  public url: string;
  public method: string;
  private headers: Headers;

  public post: RequestPost = {
    form: new FormData(),
    files: [],
    parts: [],
    data: "",
    isMultiPart: false
  };

  constructor(url: string, init: RequestInit) {
    this.url = url;
    this.method = init.method;
    this.headers = init.headers;

    if (this.headers.get("content_type")!.toLowerCase().indexOf("multipart/form-data") > -1) {
      this.post.isMultiPart = true;
    }
  }

  public readPost(onFinishedRead?: () => void, parseData = true) {
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

  public parsePost() {
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
      this.post.form = new url.URLSearchParams(this.post.data);
    }
  }
}
