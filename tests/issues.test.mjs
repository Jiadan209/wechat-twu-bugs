import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSeverity } from '../js/issues.js';

test('从正文里解析严重程度', () => {
  assert.equal(parseSeverity('### 问题信息\n- **严重程度**：致命'), '致命');
  assert.equal(parseSeverity('- **严重程度** ： 严重'), '严重');
  assert.equal(parseSeverity('- **严重程度**: 一般'), '一般');
});

test('没有该字段或字段非法时返回空串', () => {
  assert.equal(parseSeverity(''), '');
  assert.equal(parseSeverity(null), '');
  assert.equal(parseSeverity('随便写点什么'), '');
  assert.equal(parseSeverity('- **严重程度**：特别特别严重'), '');
});

import { parseType } from '../js/issues.js';

test('从正文里解析问题类型', () => {
  assert.equal(parseType('- **问题类型**：功能异常'), '功能异常');
  assert.equal(parseType('- **问题类型**：闪退卡死'), '闪退卡死');
  assert.equal(parseType('- **问题类型**：闪退/卡死'), '闪退卡死');
  assert.equal(parseType('- **问题类型**：界面显示\n- **严重程度**：一般'), '界面显示');
});

test('未知或缺失类型归入「其他」', () => {
  assert.equal(parseType('- **问题类型**：网络问题'), '其他');
  assert.equal(parseType(''), '');
  assert.equal(parseType(null), '');
});
