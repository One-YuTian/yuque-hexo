'use strict';

const ejs = require('ejs');
const Entities = require('html-entities').AllHtmlEntities;
const FrontMatter = require('hexo-front-matter');
const { formatDate, formatRaw } = require('../util');
const img2Cdn = require('../util/img2cdn');
const config = require('../config');


const entities = new Entities();
// 背景色区块支持
const colorBlocks = {
  ':::tips\n': '<div style="background: #FFFBE6;padding:10px;border: 1px solid #C3C3C3;border-radius:5px;margin-bottom:5px;">',
  ':::danger\n': '<div style="background: #FFF3F3;padding:10px;border: 1px solid #DEB8BE;border-radius:5px;margin-bottom:5px;">',
  ':::info\n': '<div style="background: #E8F7FF;padding:10px;border: 1px solid #ABD2DA;border-radius:5px;margin-bottom:5px;">',
  '\\s+:::': '</div>',
};

// 文章模板
const template = `---
<%- matter -%>

<%- raw -%>`;

/**
 * front matter 反序列化
 * @description
 * docs: https://www.npmjs.com/package/hexo-front-matter
 *
 * @param {String} body md 文档
 * @return {String} result
 */
function parseMatter(body) {
  body = entities.decode(body);
  try {
    // front matter信息的<br/>换成 \n
    const regex = /(title:|layout:|tags:|date:|categories:){1}(\S|\s)+?---/gi;
    body = body.replace(regex, a =>
      a.replace(/(<br \/>|<br>|<br\/>)/gi, '\n')
    );
    // 支持提示区块语法
    for (const key in colorBlocks) {
      body = body.replace(new RegExp(key, 'igm'), colorBlocks[key]);
    }
    const result = FrontMatter.parse(body);
    result.body = result._content;
    if (result.date) {
      result.date = formatDate(result.date);
    }
    delete result._content;
    return result;
  } catch (error) {
    return {
      body,
    };
  }
}

function parseBiliBili(body) {
    const bilibiliRegExp = /\[(.*?)]\((http:)?(https:)?(\/\/)?((([a-zA-Z0-9_-])+(\.)?){1,2}\.)?(bilibili.com)+(:\d+)?(\/((\.)?(\?)?=?&?%?[#!a-zA-Z0-9_-](\?)?)*)*\)/mg;
    const bilibiliUrlRegExp = /(http:)?(https:)?(\/\/)?((([a-zA-Z0-9_-])+(\.)?){1,2}\.)?(bilibili.com)+(:\d+)?(\/((\.)?(\?)?=?&?%?[#!a-zA-Z0-9_-](\?)?)*)*/;
    const matchs = body.match(bilibiliRegExp);
    if(matchs !== null) {
      matchs.forEach(item => {
          let url = item.match(bilibiliUrlRegExp);
          if(url !== null) {
            body = body.replace(item, `<div style="position: relative; width: 100%; height: 0; padding-bottom: 75%;"><iframe style="position: absolute; width: 100%; height: 100%; Left: 0; top: 0;" src="${url[0]}"></iframe></div>`);
          }
      })
    }
    return body;
}

function parseMusic163(body) {
  const music163RegExp = /\[(.*?)]\((http:)?(https:)?(\/\/)?(music.163.com)+(:\d+)?(\/((\.)?(\?)?=?&?%?[#!a-zA-Z0-9_-](\?)?)*)*\)/mg;
  const music163UrlRegExp = /(http:)?(https:)?(\/\/)?(music.163.com)+(:\d+)?(\/((\.)?(\?)?=?&?%?[#!a-zA-Z0-9_-](\?)?)*)*/;
  const matchs = body.match(music163RegExp);
  if(matchs !== null) {
    matchs.forEach(item => {
        let url = item.match(music163UrlRegExp);
        if(url !== null) {
          body = body.replace(item, `<iframe width="100%" height="80px" src="${url[0]}"></iframe>`);
        }
    })
  }
  return body;
}

/**
 * hexo 文章生产适配器
 *
 * @param {Object} post 文章
 * @return {String} text
 */
module.exports = async function(post) {
    // console.log(post.body);
  // 语雀img转成自己的cdn图片
  if (config.imgCdn.enabled) {
    post = await img2Cdn(post);
  }
  // bilibili 解析
  post.body = parseBiliBili(post.body);
  // 网易云音乐 解析
  post.body = parseMusic163(post.body);
  // matter 解析
  const parseRet = parseMatter(post.body);
  const { body, ...data } = parseRet;
  const { title, slug: urlname, created_at } = post;
  const raw = formatRaw(body);
  const date = data.date || formatDate(created_at);
  const tags = data.tags || [];
  const categories = data.categories || [];
  const props = {
    title: title.replace(/"/g, ''), // 临时去掉标题中的引号，至少保证文章页面是正常可访问的
    urlname,
    date,
    ...data,
    tags,
    categories,
  };
  const text = ejs.render(template, {
    raw,
    matter: FrontMatter.stringify(props),
  });
  return text;
};
