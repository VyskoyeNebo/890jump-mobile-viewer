import * as THREE from 'three';

// Interpret stock game material data. No website renderer source is included.
export async function applyStockMaterials(root, data, attributes) {
  const loader = new THREE.TextureLoader();
  const textures = new Map(), bases = new Map(), materials = new Map();
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
  const decode = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  for (const entry of attributes.entries || []) {
    const mesh = meshes[entry.mesh];
    if (!mesh || mesh.geometry.attributes.position.count !== entry.count) continue;
    if (entry.alpha) {
      const bytes = decode(entry.alpha), values = new Float32Array(entry.count);
      for (let i=0;i<values.length;i++) values[i]=bytes[i]/255;
      mesh.geometry.setAttribute('stockAlpha',new THREE.BufferAttribute(values,1));
    }
    if (entry.uv2) {
      const bytes = decode(entry.uv2);
      mesh.geometry.setAttribute('stockUV2',new THREE.BufferAttribute(new Float32Array(bytes.buffer),2));
    }
  }
  async function texture(binding, color, scale=1) {
    if (!binding || !binding.image) return null;
    const key=JSON.stringify([binding,color,scale]);
    if (!textures.has(key)) textures.set(key, (async()=>{
      const baseKey=binding.image+'|'+color;
      if(!bases.has(baseKey))bases.set(baseKey,loader.loadAsync('./assets/textures/'+binding.image+'.png'));
      const original=await bases.get(baseKey),t=original.clone();
        t.flipY=false; t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
        t.wrapS=t.wrapT=THREE.RepeatWrapping;
        t.repeat.set((binding.repeat||[1,1])[0]*scale,(binding.repeat||[1,1])[1]*scale);
        t.offset.fromArray(binding.offset||[0,0]);t.rotation=binding.rotation||0;
        t.anisotropy=2;t.needsUpdate=true;return t;
    })());
    return textures.get(key);
  }
  const rgb=(c, fallback=[1,1,1])=>new THREE.Color().setRGB(...(c||fallback));
  async function build(p,under) {
    if (p.hidden) {const m=new THREE.MeshBasicMaterial();m.visible=false;return m;}
    const layer=p.layers?p.layers[0]:p;
    const scale=(p.mode==='hard'?p.macroScale||1:1)*(layer.scale||1);
    const m=new THREE.MeshPhysicalMaterial({color:rgb(layer.color),roughness:Math.max(.08,1-(layer.gloss??(p.roughness!=null?1-p.roughness:.5))),metalness:layer.metal??p.metal??0});
    const spec=layer.specular||p.specular;
    // The game stores linear specular reflectance (F0), rather than a metalness tint.
    if(spec){m.specularColor.copy(rgb(spec.map(v=>v/.04)));m.specularIntensity=1;}
    if(p.glass){
      // Fallback glass RGB is display-space tint, unlike linear game paint colors.
      // Alpha blending exposes bright cabin surfaces and incorrectly turns black glass grey.
      m.color.copy(rgb(p.color,[.09,.12,.15])).convertSRGBToLinear();
      m.roughness=p.roughness??.15;m.metalness=0;
      m.transparent=false;m.opacity=1;m.depthWrite=true;m.side=THREE.DoubleSide;
      m.transmission=0;m.ior=1.5;m.specularIntensity=.35;
      return m;
    }
    m.opacity=p.alpha??1;m.alphaTest=p.alphaTest||0;
    m.side=p.doubleSided?THREE.DoubleSide:THREE.FrontSide;
    m.map=await texture(layer.map||p.map,true,scale);
    m.normalMap=await texture(layer.normal||p.normal,false,scale);
    m.specularColorMap=await texture(layer.specularMap||p.specularMap,true,scale);
    if(m.normalMap)m.normalScale.set(.65,.65);
    if(p.emissive)m.emissive.copy(rgb(p.emissive,[0,0,0]));
    if(p.decal||p.mode==='detail'){
      m.side=THREE.DoubleSide;m.transparent=true;m.depthWrite=false;
      m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-2;
      m.alphaTest=Math.max(p.alphaTest||0,.01);
    }
    let secondary=null,mask=null;
    if(p.layers?.length>1){
      secondary={layer:p.layers[1],map:await texture(p.layers[1].map,true,p.layers[1].scale||1)};
      mask=await texture(p.mask,false,p.maskScale||1);
    }
    const decalColor=under?rgb((under.layers?under.layers[0]:under).color):null;
    const signature=JSON.stringify([p,under||null]);
    m.customProgramCacheKey=()=>signature;
    m.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float stockAlpha; attribute vec2 stockUV2; varying float vStockAlpha; varying vec2 vStockUV; varying vec2 vStockUV2;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvStockAlpha=stockAlpha;vStockUV=uv;vStockUV2=stockUV2;');
      shader.fragmentShader='varying float vStockAlpha; varying vec2 vStockUV; varying vec2 vStockUV2;\n'+shader.fragmentShader;
      // DDNA contains normal XY and smoothness in alpha. Preserve both channels.
      if(m.normalMap){
        shader.uniforms.stockGloss={value:layer.gloss??1};
        shader.fragmentShader='uniform float stockGloss;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(1.0-texture2D(normalMap,vNormalMapUv).a*stockGloss,0.08,1.0);');
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;','vec3 mapN = texture2D(normalMap,vNormalMapUv).xyz*2.0-1.0;mapN.z=sqrt(max(0.001,1.0-dot(mapN.xy,mapN.xy)));'));
      }
      let after='';
      if(secondary){
        shader.uniforms.stockSecond={value:secondary.map};shader.uniforms.stockSecondColor={value:rgb(secondary.layer.color)};
        shader.uniforms.stockMask={value:mask};shader.uniforms.stockBlend={value:p.blendFactor||1};shader.uniforms.stockFalloff={value:p.blendFalloff||1};
        shader.uniforms.stockSecondRepeat={value:secondary.map?secondary.map.repeat:new THREE.Vector2(1,1)};
        shader.fragmentShader='uniform sampler2D stockSecond;uniform sampler2D stockMask;uniform vec3 stockSecondColor;uniform vec2 stockSecondRepeat;uniform float stockBlend;uniform float stockFalloff;\n'+shader.fragmentShader;
        const maskSample=mask?'texture2D(stockMask,vStockUV).r':'0.0';
        const secondSample=secondary.map?'texture2D(stockSecond,vStockUV*stockSecondRepeat).rgb':'vec3(1.0)';
        after+='float wear=clamp(('+(p.vertexBlend?'(1.0-vStockAlpha)':'1.0')+'*stockBlend-'+maskSample+')*stockFalloff,0.0,1.0);diffuseColor.rgb=mix(diffuseColor.rgb,stockSecondColor*'+secondSample+',wear);';
      }
      if(decalColor&&p.mode==='detail'){
        shader.uniforms.stockUnderColor={value:decalColor};shader.fragmentShader='uniform vec3 stockUnderColor;\n'+shader.fragmentShader;
        after+='diffuseColor.rgb*=stockUnderColor;';
      }
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+after);
      if(p.decal)shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=vStockAlpha;\n#include <alphatest_fragment>');
    };
    return m;
  }
  const plans=[];
  for(const o of meshes){
    const meta=o.material.userData||{},id=meta.sourceIndex,p=data.profiles[data.base[id]];
    if(!p){o.visible=false;continue;}
    if(/internal_damage|(^|_)dmg|(^|_)dm_/i.test(meta.sourceName||'')){o.visible=false;continue;}
    o.geometry.deleteAttribute('color');
    if(!o.geometry.attributes.stockAlpha){const a=new Float32Array(o.geometry.attributes.position.count);a.fill(1);o.geometry.setAttribute('stockAlpha',new THREE.BufferAttribute(a,1));}
    if(!o.geometry.attributes.stockUV2)o.geometry.setAttribute('stockUV2',o.geometry.attributes.uv2||o.geometry.attributes.uv);
    const under=data.profiles[data.base[meta.underIndex]],key=JSON.stringify([id,meta.underIndex]);
    if(!materials.has(key))materials.set(key,build(p,under));
    plans.push(materials.get(key).then(material=>{o.material=material;o.visible=material.visible;o.renderOrder=p.decal||p.mode==='detail'?2:0;}));
  }
  await Promise.all(plans);
  return {materialCount:materials.size,textureCount:textures.size};
}
