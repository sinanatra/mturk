import{s as L,o as M,n as u}from"../chunks/scheduler.DGlNlUkI.js";import{S as A,i as G,e as y,a as k,t as m,b as I,d as p,f as _,p as R,g as q,r as $,s as v,h as T,j as S,u as d,c as w,k as E,l as C,v as g,y as x,w as h,x as j}from"../chunks/index.DKXqwyW7.js";import{T as N}from"../chunks/Text_3.Dkf6gw3k.js";import{M as P,G as z}from"../chunks/Gallery.uASQZAiM.js";import{t as B}from"../chunks/transform.DbdcILkC.js";function D(l){let t,a,n,o,c,r,i;return a=new N({}),o=new P({props:{data:l[0]}}),r=new z({props:{data:l[0]}}),{c(){t=q("article"),$(a.$$.fragment),n=v(),$(o.$$.fragment),c=v(),$(r.$$.fragment),this.h()},l(e){t=T(e,"ARTICLE",{class:!0,style:!0});var s=S(t);d(a.$$.fragment,s),n=w(s),d(o.$$.fragment,s),c=w(s),d(r.$$.fragment,s),s.forEach(_),this.h()},h(){E(t,"class","container svelte-1wl6qin"),C(t,"--color-1","#d2e5ff"),C(t,"--color-2","#a79bb4")},m(e,s){k(e,t,s),g(a,t,null),x(t,n),g(o,t,null),x(t,c),g(r,t,null),i=!0},p(e,s){const f={};s&1&&(f.data=e[0]),o.$set(f);const b={};s&1&&(b.data=e[0]),r.$set(b)},i(e){i||(p(a.$$.fragment,e),p(o.$$.fragment,e),p(r.$$.fragment,e),i=!0)},o(e){m(a.$$.fragment,e),m(o.$$.fragment,e),m(r.$$.fragment,e),i=!1},d(e){e&&_(t),h(a),h(o),h(r)}}}function F(l){let t,a="Loading...";return{c(){t=q("article"),t.textContent=a,this.h()},l(n){t=T(n,"ARTICLE",{class:!0,"data-svelte-h":!0}),j(t)!=="svelte-1qk6kpe"&&(t.textContent=a),this.h()},h(){E(t,"class","svelte-1wl6qin")},m(n,o){k(n,t,o)},p:u,i:u,o:u,d(n){n&&_(t)}}}function H(l){let t,a,n,o;const c=[F,D],r=[];function i(e,s){return e[0].length==0?0:1}return t=i(l),a=r[t]=c[t](l),{c(){a.c(),n=y()},l(e){a.l(e),n=y()},m(e,s){r[t].m(e,s),k(e,n,s),o=!0},p(e,[s]){let f=t;t=i(e),t===f?r[t].p(e,s):(R(),m(r[f],1,1,()=>{r[f]=null}),I(),a=r[t],a?a.p(e,s):(a=r[t]=c[t](e),a.c()),p(a,1),a.m(n.parentNode,n))},i(e){o||(p(a),o=!0)},o(e){m(a),o=!1},d(e){e&&_(n),r[t].d(e)}}}function J(l,t,a){let n=[];return M(async o=>{a(0,n=await B("desktop_out.tsv"))}),[n]}class W extends A{constructor(t){super(),G(this,t,J,H,L,{})}}export{W as component};
