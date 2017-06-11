const request = require('request-promise')
const fs = require("fs")
const jar = request.jar()

req = request.defaults({
  jar,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
  }
})

const tempDir = 'temp'
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync('temp')
}

function hash33(t) {
  let e
  for (e = 0, i = 0, n = t.length; n > i; ++i)
    e += (e << 5) + t.charCodeAt(i);
  return 2147483647 & e
}

function getACSRFToken(key) {
  let hash = 5381;
  for (let i = 0, len = key.length; i < len; ++i) {
    hash += (hash << 5) + key.charAt(i).charCodeAt();
  }
  return hash & 2147483647;
}

function getCookie(cookies, key) {
  return cookies.find(cookie => cookie.key === key)
}

function login() {
  return req.get({
    url: 'https://ssl.ptlogin2.qq.com/ptqrshow?appid=549000912&e=2&l=M&s=3&d=72&v=4&t=0.20373856876736074&daid=5',
    encoding: 'binary'
  }).then(res => {
    fs.writeFileSync(`${tempDir}/qr.png`, res, 'binary')
  })
      .then(() => hash33(jar.getCookies('https://ssl.ptlogin2.qq.com')[0].value))
      .then(token => {
        return new Promise(function (resolve) {
          const timer = setInterval(function () {
            req.get(`https://ssl.ptlogin2.qq.com/ptqrlogin?u1=https%3A%2F%2Fqzs.qzone.qq.com%2Fqzone%2Fv5%2Floginsucc.html%3Fpara%3Dizone%26from%3Diqq&ptqrtoken=${token}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052&action=0-0-1497188369306&js_ver=10222&js_type=1&login_sig=ZTcX*K1un1*g2SmqWbU*spNKoDglRKwNXunLWQcQX0WbSB320MSJc-uaZC8NuCcA&pt_uistyle=40&aid=549000912&daid=5&has_onekey=1&`,
                function (err, resp, body) {
                  if (body.startsWith("ptuiCB('66'")) {
                    console.log('等待扫描二维码');
                    return
                  }

                  if (body.startsWith("ptuiCB('65'")) {
                    console.log('二维码已失效');
                    return
                  }

                  if (body.startsWith("ptuiCB('67'")) {
                    console.log('二维码已扫描，等待确认')
                    return
                  }

                  if (body.startsWith("ptuiCB('0'")) {
                    console.log('已确认登录')
                    clearInterval(timer)
                    resolve(/https[^']+/.exec(body)[0])
                  }
                })
          }, 1000)
        })
      })
      .then(req)
      .then(function () {
        const cookies = jar.getCookies('https://user.qzone.qq.com')
        const uin = getCookie(cookies, 'uin').value.substr(1)
        const token = getACSRFToken(getCookie(cookies, 'p_skey').value)
        return {
          uin,
          token
        }
      })
}

function like(user, feed) {
  req.post({
    url: `https://h5.qzone.qq.com/proxy/domain/w.qzone.qq.com/cgi-bin/likes/internal_dolike_app?g_tk=${user.token}`,
    form: {
      qzreferrer: `https://user.qzone.qq.com/${user.uin}`,
      opuin: user.uin,
      unikey: `http://user.qzone.qq.com/${feed.uin}/mood/${feed.key}`,
      curkey: `http://user.qzone.qq.com/${feed.uin}/mood/${feed.key}`,
      from: 1,
      appid: 311,
      typeid: 0,
      abstime: feed.abstime,
      fid: feed.key,
      active: 0,
      fupdate: 1,
    }
  }).then(function (body) {

  })
}

login()
    .then(function (user) {

      function refresh() {
        req(`https://h5.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/cgi_get_feeds_count.cgi?uin=${user.uin}&g_tk=${user.token}`)
            .then(body => parseInt(/friendFeeds_new_cnt:(\d+),/.exec(body)[1]))
            .then(friendFeeds => {
              console.log(`新动态数：${friendFeeds}`)

              if (friendFeeds === 0) {
                return
              }

              req(`https://h5.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds3_html_more?uin=${user.uin}&scope=0&view=1&daylist=&uinlist=&gid=&flag=1&filter=all&applist=all&refresh=0&aisortEndTime=0&aisortOffset=0&getAisort=0&aisortBeginTime=0&pagenum=1&externparam=&firstGetGroup=0&icServerTime=0&mixnocache=0&scene=0&begintime=0&count=10&dayspac=0&sidomain=qzonestyle.gtimg.cn&useutf8=1&outputhtmlfeed=1&usertime=${Date.now()}&getob=1&g_tk=${user.token}`)
                  .then(function (body) {
                    function _Callback(data) {
                      data.data.data.slice(0, friendFeeds).forEach((feed) => {
                        console.log(`为 "${feed.nickname}" 的动态点赞`)
                        like(user, feed)
                      })
                    }

                    eval(body)
                  })
            })
      }

      refresh()
      setInterval(refresh, 1000)
    })