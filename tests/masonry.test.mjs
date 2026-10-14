import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMasonryLayout } from '../src/lib/masonry.ts';

test('first photos start left to right and subsequent photos fill shorter columns', () => {
  const { items } = getMasonryLayout([16/9,9/16,16/9,16/9,16/9,16/9], 1432, 4);
  assert.deepEqual(items.slice(0,4).map(item=>item.top),[0,0,0,0]);
  assert.ok(items.slice(0,4).every((item,index)=>index===0||item.left>items[index-1].left));
  assert.equal(items[4].left,items[0].left);
  assert.equal(items[4].top,items[0].height+6);
  assert.equal(items[5].left,items[2].left);
});

test('landscape and portrait ratios survive resizing without overlaps or column gaps', () => {
  const ratios=[16/9,9/16,16/9,16/9,9/16,1,16/9,9/16,16/9];
  for (const [width,columns] of [[382,2],[760,2],[1432,4]]) {
    const { items,height }=getMasonryLayout(ratios,width,columns);
    assert.equal(new Set(items.map(item=>item.left)).size,columns);
    for (let index=0;index<items.length;index++) {
      const item=items[index];
      assert.ok(Math.abs(item.width/item.height-ratios[index])<0.00001);
      assert.ok(item.left>=0&&item.left+item.width<=width);
      const preceding=items.slice(0,index).filter(previous=>previous.left===item.left).at(-1);
      assert.equal(item.top,preceding?preceding.top+preceding.height+6:0);
    }
    assert.equal(height,Math.max(...items.map(item=>item.top+item.height)));
  }
});

test('empty and single-photo galleries have the correct height', () => {
  assert.deepEqual(getMasonryLayout([],382,2),{items:[],height:0});
  const layout=getMasonryLayout([9/16],382,2);
  assert.equal(layout.items.length,1);
  assert.equal(layout.items[0].left,0);
  assert.equal(layout.height,layout.items[0].height);
});
