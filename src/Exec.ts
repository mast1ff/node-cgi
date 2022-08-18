import { Context } from "./Context";

let context: Context | null = null as unknown as Context;

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
  context!.include(process.env.PATH_TRANSLATED!);
}

context.request.method = "GET";

if (context.request.method != "POST") {
  onReady();
} else {
  context.request.readPost(onReady);
}
