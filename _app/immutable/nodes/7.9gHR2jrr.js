import{s as L,e as v,i as b,d as _,o as M,b as C,f as y,h as T,j as q,k as w,p as E,v as x,m as z,n as u}from"../chunks/scheduler.Bx9lCxiB.js";import{S as A,i as G,a as f,c as I,t as p,g as R,b as $,d,m as g,e as h}from"../chunks/index.D00NIsm6.js";import{T as S}from"../chunks/Text_1.DkLhGfwl.js";import{M as j}from"../chunks/Map.Knl79Mm5.js";import{G as N}from"../chunks/Gallery.ChddCJRr.js";import{t as P}from"../chunks/transform.Kr_La7z8.js";function B(l){let t,a,n,o,c,r,i;return a=new S({}),o=new j({props:{data:l[0]}}),r=new N({props:{data:l[0]}}),{c(){t=C("article"),$(a.$$.fragment),n=y(),$(o.$$.fragment),c=y(),$(r.$$.fragment),this.h()},l(e){t=T(e,"ARTICLE",{class:!0});var s=q(t);d(a.$$.fragment,s),n=w(s),d(o.$$.fragment,s),c=w(s),d(r.$$.fragment,s),s.forEach(_),this.h()},h(){E(t,"class","container svelte-1a8zxb4")},m(e,s){b(e,t,s),g(a,t,null),x(t,n),g(o,t,null),x(t,c),g(r,t,null),i=!0},p(e,s){const m={};s&1&&(m.data=e[0]),o.$set(m);const k={};s&1&&(k.data=e[0]),r.$set(k)},i(e){i||(p(a.$$.fragment,e),p(o.$$.fragment,e),p(r.$$.fragment,e),i=!0)},o(e){f(a.$$.fragment,e),f(o.$$.fragment,e),f(r.$$.fragment,e),i=!1},d(e){e&&_(t),h(a),h(o),h(r)}}}function D(l){let t,a="Loading...";return{c(){t=C("article"),t.textContent=a,this.h()},l(n){t=T(n,"ARTICLE",{class:!0,"data-svelte-h":!0}),z(t)!=="svelte-1qk6kpe"&&(t.textContent=a),this.h()},h(){E(t,"class","svelte-1a8zxb4")},m(n,o){b(n,t,o)},p:u,i:u,o:u,d(n){n&&_(t)}}}function F(l){let t,a,n,o;const c=[D,B],r=[];function i(e,s){return e[0].length==0?0:1}return t=i(l),a=r[t]=c[t](l),{c(){a.c(),n=v()},l(e){a.l(e),n=v()},m(e,s){r[t].m(e,s),b(e,n,s),o=!0},p(e,[s]){let m=t;t=i(e),t===m?r[t].p(e,s):(R(),f(r[m],1,1,()=>{r[m]=null}),I(),a=r[t],a?a.p(e,s):(a=r[t]=c[t](e),a.c()),p(a,1),a.m(n.parentNode,n))},i(e){o||(p(a),o=!0)},o(e){f(a),o=!1},d(e){e&&_(n),r[t].d(e)}}}function H(l,t,a){let n=[];return M(async o=>{a(0,n=await P("windows.tsv"))}),[n]}class W extends A{constructor(t){super(),G(this,t,H,F,L,{})}}export{W as component};
