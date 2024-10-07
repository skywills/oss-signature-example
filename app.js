const http = require("http");
const https = require("https");
const crypto = require("crypto");

function readAllData(incoming) {
  return new Promise((resolve, reject) => {
    let rawData = "";
    incoming.on("data", (chunk) => {
      rawData += chunk;
    });
    incoming.on("end", () => {
      resolve(rawData);
    });
    incoming.on("error", (e) => {
      reject(e);
    });
  });
}

/**
 * 1. 获取OSS的公钥
 * 1. Obtain the public key of OSS
 * @return {Promise<string>}
 */
async function getPublicKey(req) {
  const pubKeyUrl = Buffer.from(
    req.headers["x-oss-pub-key-url"],
    "base64"
  ).toString();
  let httplib;
  if (pubKeyUrl.startsWith("http://gosspublic.alicdn.com/")) {
    httplib = http;
  } else if (pubKeyUrl.startsWith("https://gosspublic.alicdn.com/")) {
    httplib = https;
  }
  if (!httplib) {
    throw new Error("Failed: x-oss-pub-key-url field is not valid.");
  }
  return new Promise((resolve, reject) => {
    httplib.get(pubKeyUrl, async (res) => {
      if (res.statusCode !== 200) {
        reject(
          new Error(
            `Failed: Get OSS public key ${res.statusCode} ${res.statusMessage}`
          )
        );
      } else {
        resolve(await readAllData(res));
      }
    });
  });
}

/**
 * 2. 获取base64解码后OSS的签名header
 * 2. Obtain the OSS signature header after base64 decoding
 */
function getAuthorization(req) {
  const authorization = req.headers["authorization"];
  if (!authorization) {
    throw new Error("Failed: authorization field is not valid.");
  }
  return Buffer.from(authorization, "base64");
}

/**
 * 3. 获取待签名字符串
 * 3. Get the string to be signed
 */
async function getToSignByte(req) {
  const body = await readAllData(req);
  console.log('body:', body)
  const fullReqUrl = new URL('/oss/post', `http://${req.headers.host}`);
  console.log('fullReqUrl:', fullReqUrl)
  return (
    decodeURIComponent(fullReqUrl.pathname) + fullReqUrl.search + "\n" + body
  );
}

/**
 * 4. 验证签名
 * 4. Verify signature
 */
function verifySignature(pubKey, signature, byteMD5) {
  const verify = crypto.createVerify("RSA-MD5");
  verify.update(byteMD5);
  return verify.verify(pubKey, signature);
}

function responseSuccess(response) {
  const body = JSON.stringify({ Status: "OK" });
  response
    .writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": body.length,
    })
    .end(body);
}

function responseFailed(response, msg) {
  response.writeHead(400).end(msg);
}

async function handlerOSSCallback(req, resp) {
  if (!req.headers["authorization"] || !req.headers["x-oss-pub-key-url"]) {
    responseFailed(resp, "Failed: authorization or x-oss-pub-key-url field");
    return;
  }
  let pubKey, signature, toSignByte;
  try {
    [pubKey, signature, toSignByte] = await Promise.all([
      getPublicKey(req),
      getAuthorization(req),
      getToSignByte(req),
    ]);
    console.log('headers:', JSON.stringify(req.headers))
    console.log('-----------------------------------------------------------')
    console.log('body:', req.body)
    console.log('-----------------------------------------------------------')
    console.log('req.url:', req.url)
    console.log('-----------------------------------------------------------')
    console.log('pubKey:', pubKey)
    console.log('-----------------------------------------------------------')
    console.log('signature:', signature)
    console.log('-----------------------------------------------------------')
    console.log('toSignByte:', toSignByte)
    console.log('-----------------------------------------------------------')

  } catch (e) {
    responseFailed(resp, e.message);
    return;
  }
  if (verifySignature(pubKey, signature, toSignByte)) {
    console.log('Success')
    responseSuccess(resp);
  } else {
    console.log('Failed: verify')
    responseFailed(resp, "Failed: verify");
  }
}

http
  .createServer(function (req, resp) {
    if (req.method === "POST") {
      handlerOSSCallback(req, resp);
    } else {
      resp.end();
    }
  })
  .listen(8002);

console.log("start listening to 8002");
