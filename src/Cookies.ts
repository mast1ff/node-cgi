export interface CookieOptions {
  domain?: string;
  path?: string;
  expires?: Date;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
}

export interface Cookie extends CookieOptions {
  name: string;
  value: string;
}

export class Cookies {
  private store: Map<string, string>;

  constructor(cookieHeader: string | null) {
    this.store = new Map();
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

  public get(key: string) {
    return this.store.get(key);
  }

  get data() {
    const store: Record<string, string> = {};
    this.store.forEach((val, key) => {
      store[key] = val;
    });
    return store;
  }

  public static serializeCookie(cookie: Cookie) {
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
