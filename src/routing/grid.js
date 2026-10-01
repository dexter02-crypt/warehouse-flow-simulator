export function validateGrid(raw) {
  if (!raw || !Number.isInteger(raw.width) || !Number.isInteger(raw.height)) throw new Error("grid");
  const {width,height,cells}=raw;
  if (width < 2 || height < 2 || width > 48 || height > 32) throw new Error("grid-size");
  if (!Array.isArray(cells) || cells.length !== width*height || cells.some(v=>![0,1,3,6].includes(v))) throw new Error("grid-cells");
  return {width,height,cells:[...cells]};
}
export function indexOf(grid,x,y){const g=validateGrid(grid);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=g.width||y>=g.height)throw new Error("coords");return y*g.width+x;}
export function coordsOf(grid,index){const g=validateGrid(grid);if(!Number.isInteger(index)||index<0||index>=g.cells.length)throw new Error("index");return {x:index%g.width,y:Math.floor(index/g.width)};}
export function neighbors(grid,index){const g=validateGrid(grid),{x,y}=coordsOf(g,index),out=[];const add=(x2,y2)=>{if(x2>=0&&y2>=0&&x2<g.width&&y2<g.height){const i=y2*g.width+x2;if(g.cells[i])out.push(i);}};add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1);return out;}
export function pathCost(grid,path){const g=validateGrid(grid);if(!Array.isArray(path)||!path.length)return 0;let cost=0;for(let i=1;i<path.length;i++){if(!neighbors(g,path[i-1]).includes(path[i]))throw new Error("non-adjacent-path");cost+=g.cells[path[i]];}return cost;}
