/**
 * 打包成单个组件
 * 创建日期：2020/4/2
 * @author mzhong
 */

// 配置
const conf = require('./build-conf');
const brScanner = require('./build-resources-scanner');
// 文件操作
const fs = require('fs');
const utils = require('./build-utils');
const exportTemplate = fs.readFileSync('build/build-export-template.js').toString(conf.encoding);

/**
 * 合并资源文件，将子资源合并到父级
 * @param resources
 * @param type
 * @returns {{}}
 * @private
 */
function _mergeResources(resources, type) {
    let _resourcesMap = {};
    for (let item of resources) {
        if (!type || item.type === type) {
            _resourcesMap[item.filepath] = _resourcesMap[item.filepath] || [];
            _resourcesMap[item.filepath].push(item);
        }
        if (item.resources) {
            let itemResources = _mergeResources(item.resources, type);
            for (let filepath in itemResources) {
                if (itemResources.hasOwnProperty(filepath)) {
                    var _resources = utils.arrayMerge(_resourcesMap[filepath] || [], itemResources[filepath]);
                    if (_resources.length) {
                        _resourcesMap[filepath] = _resources;
                    }
                }
            }
        }
    }
    return _resourcesMap;
}

function _buildComponentJavascript(name) {
    let data = brScanner(conf.in + '/' + name, name);
    let content = data.content.replace(/\r\n/g, '\r\n\t\t');
    // 构造返回
    content = content + '\r\n\t\treturn ' + name + ';';
    // 组件定义区域
    content = exportTemplate.replace('//__hook_component_content__', content);
    // 组件资源引用表
    let textResourceMap = _mergeResources(data.resources, 'html');
    // 文本资源引用
    for (let filepath in textResourceMap) {// 遍历表
        let textResources = textResourceMap[filepath];
        // 一个文件可能有多个引用
        if (textResources.length) {
            // 替换引用（require(xxx)
            for (let textResource of textResources) {
                let resourceContent = textResource.content.replace(/'/g, "\'");
                resourceContent = "'" + resourceContent + "'";
                content = content.replace(utils.buildRequirePattern(textResource.name), resourceContent);
            }
        }
    }
    // 代码引用
    let scriptResourceMap = _mergeResources(data.resources, 'js');
    for (let filepath in scriptResourceMap) {
        let scriptResources = scriptResourceMap[filepath];
        if (scriptResources.length) {
            // 替换引用（require(xxx)
            for (let scriptResource of scriptResources) {
                let scriptContent = scriptResource.content.replace(/\r\n/g, '\r\n\t\t');
                content = content.replace(utils.buildRequirePattern(scriptResource.name), scriptContent);
            }
        }
    }
    // 替换组件名
    content = content.replace(/root\.justUI\.component =/, 'root.justUI.' + name + ' = ');
    // 输出文件
    fs.writeFileSync(conf.out + '/' + name + '.js', content);
}

function _buildComponentCss(name) {
    let file = conf.in + '/' + name + '/' + name + '.css';
    if (fs.existsSync(file)) {
        let outFile = conf.out + '/' + name + '.css';
        fs.writeFileSync(outFile, fs.readFileSync(file).toString(conf.encoding));
    }
}

function _buildComponent(name) {
    _buildComponentJavascript(name);
    _buildComponentCss(name);
}

module.exports = function () {
    // 读取组件目录
    let files = fs.readdirSync(conf.in);
    for (let file of files) {
        let stat = fs.statSync(conf.in + '/' + file);
        if (stat.isDirectory() && file !== '_utils') {
            console.log('打包单个组件：' + file);
            _buildComponent(file);
        }
    }
};