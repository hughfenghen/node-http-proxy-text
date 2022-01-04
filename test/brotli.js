'use strict';
/**
 * Test content-encoding for brotli
 */

const assert = require('chai').assert;

const zlib = require('zlib');
const http = require('http');
const httpProxy = require('http-proxy');
const modifyResponse = require('..');

const SERVER_PORT = 5002;
const TARGET_SERVER_PORT = 5003;

describe('modifyResponse--brotli', () => {
  let proxy, server, targetServer;
  beforeEach(() => {
    // Create a proxy server
    proxy = httpProxy.createProxyServer({
      target: 'http://localhost:' + TARGET_SERVER_PORT,
    });

    // Create your server and then proxies the request
    server = http
      .createServer((req, res) => proxy.web(req, res))
      .listen(SERVER_PORT);

    // Create your target server
    targetServer = http
      .createServer(function(req, res) {
        // Create brotli content
        let brotli = zlib.createBrotliCompress();
        let _write = res.write;
        let _end = res.end;

        brotli.on('data', buf => _write.call(res, buf));
        brotli.on('end', () => _end.call(res));

        res.write = data => brotli.write(data);
        res.end = () => brotli.end();

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'br',
        });

        res.write(
          JSON.stringify({
            name: 'node-http-proxy-json',
            age: 1,
            version: '1.0.0',
          })
        );

        res.end();
      })
      .listen(TARGET_SERVER_PORT);
  });

  afterEach(() => {
    proxy.close();
    server.close();
    targetServer.close();
  });

  describe('callback returns data', () => {
    beforeEach(() => {
      // Listen for the `proxyRes` event on `proxy`.
      proxy.on('proxyRes', (proxyRes, req, res) => {
        modifyResponse(res, proxyRes, body => {
          body = JSON.parse(body)
          if (body) {
            // modify some information
            body.age = 2;
            delete body.version;
          }
          return JSON.stringify(body);
        });
      });
    });
    it('brotli: modify response json successfully', done => {
      // Test server
      http.get('http://localhost:' + SERVER_PORT, res => {
        let body = '';
        let debrotli = zlib.createBrotliDecompress();
        res.pipe(debrotli);
        debrotli
          .on('data', function(chunk) {
            body += chunk;
          })
          .on('end', function() {
            assert.equal(
              JSON.stringify({ name: 'node-http-proxy-json', age: 2 }),
              body
            );

            done();
          });
      });
    });
  });

  describe('callback returns a promise', () => {
    beforeEach(() => {
      // Listen for the `proxyRes` event on `proxy`.
      proxy.on('proxyRes', (proxyRes, req, res) => {
        modifyResponse(res, proxyRes, body => {
          body = JSON.parse(body)
          if (body) {
            // modify some information
            body.age = 2;
            delete body.version;
          }
          return Promise.resolve(JSON.stringify(body));
        });
      });
    });
    it('brotli: modify response json successfully', done => {
      // Test server
      http.get('http://localhost:' + SERVER_PORT, res => {
        let body = '';
        let debrotli = zlib.createBrotliDecompress();
        res.pipe(debrotli);

        debrotli
          .on('data', function(chunk) {
            body += chunk;
          })
          .on('end', function() {
            assert.equal(
              JSON.stringify({ name: 'node-http-proxy-json', age: 2 }),
              body
            );

            done();
          });
      });
    });
  });
});
