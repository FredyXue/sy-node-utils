'use strict';

const _ = require('lodash');

const variable_reg = /\{\{(.*?)\}\}/g;
const if_reg = /\{\{if\s+(.*?)\}\}/;
const else_if_reg = /\{\{else\s+if\s+(.*?)\}\}/;
const else_reg = /\{\{else\}\}/;
const end_if_reg = /\{\{\s*\/if\s*\}\}/; // 加上空格, 全文判断
const condition_reg = /\{\{(if\s+(?:.*?)|else|else\s+if(?:.*?)|\/if)\}\}/g;

const logic_reg = /===|!==|!|\|\||&&|>|</;
const string_reg = /"(.*?)"/;

function render(str, data) {
    if (end_if_reg.test(str)) {
        return ifrender(str, data);
    }
    return str.replace(variable_reg, function(match, p1) {
        p1 = p1.trim();
        return _.get(data, p1, '');
    });
}


function ifrender(str, data) {
    str = str.replace(variable_reg, function(match, p1) {
        p1 = p1.trim(); // if表达式去除前后空格
        if (p1.includes('if ') || p1.includes('else') || p1.includes('/if')) {
            return `{{${p1}}}`;
        }
        return _.get(data, p1, '');
    });

    let match = condition_reg.exec(str);
    let next_match = null;

    const root = [{
        id: -1,
        node: [],
        contain_str: str.slice(0, match.index),
        type: 1,
        value: true,
    }];
    root.parent = null;
    let current = root;

    let count = 0;

    while (match) {
        next_match = condition_reg.exec(str);
        const match_str = match[0];

        const info = {
            id: count,
            start: match.index,
            end: match.index + match[0].length,
        };
        info.contain_str = next_match ? str.slice(info.end, next_match.index) : str.slice(info.end);

        if (if_reg.test(match_str)) {
            info.type = 1;
            info.value = renderExpression(if_reg.exec(match_str)[1], data);

            const i = current.length - 1;
            const child = [ info ];
            child.parent = current;
            if (current[i].node) {
                current[i].node.push(child);
            } else {
                current[i].node = [ child ];
            }
            current = child;

        } else if (else_if_reg.test(match_str)) {
            info.type = 2;
            info.value = renderExpression(else_if_reg.exec(match_str)[1], data);
            current.push(info);
        } else if (else_reg.test(match_str)) {
            info.type = 3;
            current.push(info);
        } else {
            info.type = 4;
            current.push(info);
            current = current.parent;
        }

        match = next_match;
        count++;
    }

    return spell(root);
}

function spell(current) {
    let result = '';
    for (const info of current) {
        if (info.type === 1 || info.type === 2) {
            if (info.value) {
                result += info.contain_str;
                if (info.node) {
                    for (const child of info.node) {
                        result += spell(child);
                    }
                }
                if (current.parent) {
                    result += current[current.length - 1].contain_str;
                }
                break;
            }
        } else {
            result += info.contain_str;
        }
    }
    return result;
}


function renderExpression(str, data) {
    const match = logic_reg.exec(str);
    let result = false;
    let val1,
        val2;
    if (match) {
        const logic_symbol = match[0];
        switch (logic_symbol) {
        case '===':
            [ val1, val2 ] = getVal(str, data, '===');
            result = val1 === val2;
            break;
        case '!==':
            [ val1, val2 ] = getVal(str, data, '!==');
            result = val1 !== val2;
            break;
        case '!':
            [ val1 ] = getVal(str, data, '!');
            result = !val1;
            break;
        case '>':
            [ val1, val2 ] = getVal(str, data, '>');
            result = val1 > val2;
            break;
        case '<':
            [ val1, val2 ] = getVal(str, data, '<');
            result = val1 < val2;
            break;
        case '||':
            [ val1, val2 ] = getVal(str, data, '||');
            result = val1 || val2;
            break;
        case '&&':
            [ val1, val2 ] = getVal(str, data, '&&');
            result = val1 && val2;
            break;
        default:
            break;
        }
    } else {
        result = _.get(data, str, false);
    }

    return Boolean(result);
}


function getVal(str, data, logic_symbol) {
    const result = [];
    let vals = [];
    if (logic_symbol === '!') {
        str = str.replace('!', '');
        vals.push(str);
    } else {
        vals = str.split(logic_symbol);
    }
    for (let val of vals) {
        val = val.trim();
        const match = string_reg.exec(val);
        if (match) {
            val = match[1];
        } else if (!isNaN(+val)) {
            val = +val;
        } else {
            val = _.get(data, val, '');
        }
        result.push(val);
    }
    return result;
}


module.exports = render;
