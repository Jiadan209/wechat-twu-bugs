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
