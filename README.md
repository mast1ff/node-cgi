# @TKNF/NODE-CGI

This package is a fork of [cgi-node](https://github.com/DEDAjs/cgi-node).

Scripts to run JavaScript as CGI on Apache, Nginx, and other web servers.

## Setup

1. Install [Node.js](https://nodejs.org/en/) on your web server.
2. Download `node-cgi.js`, `ejs.js` and `ejs-utils.js` from [here](https://github.com/mast1ff/node-cgi/releases/tag/v0.1.0) and copy them into the cgi-bin folder.
3. Update the first line within `node-cgi.js` to point to the location of the node executable you uploaded earlier.
4. Specify the folder where the session files are stored in `process.env.SESSION_PATH` in `cgi-node.js`
5. Add the `Action` and `Handler` to your config file or `.htaccess` file.

This is done.
