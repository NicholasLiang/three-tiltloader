/*!
 * three-tiltloader
 * https://github.com/icosa-gallery/three-tiltloader
 * Copyright (c) 2021 Icosa Gallery
 * Released under the Apache 2.0 Licence.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three'), require('three/examples/jsm/loaders/GLTFLoader'), require('three/examples/jsm/loaders/TiltLoader')) :
	typeof define === 'function' && define.amd ? define(['exports', 'three', 'three/examples/jsm/loaders/GLTFLoader', 'three/examples/jsm/loaders/TiltLoader'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global["three-tiltloader"] = {}, global.three, global.GLTFLoader, global.TiltLoader$1));
})(this, (function (exports, three, GLTFLoader, TiltLoader$1) { 'use strict';

	function updateBrushes(updateableMeshes, elapsedTime, cameraPosition) {
	    var time = new three.Vector4(elapsedTime / 20, elapsedTime, elapsedTime * 2, elapsedTime * 3);
	    updateableMeshes.forEach((mesh) => {
	        var material = mesh.material;
	        switch (material.name) {
	            case "material_DiamondHull":
	                material.uniforms["cameraPosition"].value = cameraPosition;
	                material.uniforms["u_time"].value = time;
	                break;
	            case "material_ChromaticWave":
	            case "material_Comet":
	            case "material_Disco":
	            case "material_Electricity":
	            case "material_Embers":
	            case "material_Fire":
	            case "material_Hypercolor":
	            case "material_LightWire":
	            case "material_NeonPulse":
	            case "material_Plasma":
	            case "material_Rainbow":
	            case "material_Snow":
	            case "material_Stars":
	            case "material_Streamers":
	            case "material_Waveform":
	            case "material_WigglyGraphite":
	                material.uniforms["u_time"].value = time;
	                break;
	        }
	    });
	}

	// Adapted from original GLTF 1.0 Loader in three.js r86

	class LegacyGLTFLoader extends three.Loader {


	    load ( url, onLoad, onProgress, onError ) {

	        var scope = this;

	        var resourcePath;

	        if ( this.resourcePath !== '' ) {

	            resourcePath = this.resourcePath;

	        } else if ( this.path !== '' ) {

	            resourcePath = this.path;

	        } else {

	            resourcePath = three.LoaderUtils.extractUrlBase( url );

	        }

	        var loader = new three.FileLoader( scope.manager );

	        loader.setPath( this.path );
	        loader.setResponseType( 'arraybuffer' );

	        loader.load( url, function ( data ) {

	            scope.parse( data, resourcePath, onLoad );

	        }, onProgress, onError );

	    }

	    parse ( data, path, callback ) {

	        var content;
	        var extensions = {};

	        var magic = three.LoaderUtils.decodeText( new Uint8Array( data, 0, 4 ) );

	        if ( magic === BINARY_EXTENSION_HEADER_DEFAULTS.magic ) {

	            extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );
	            content = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content;

	        } else {

	            content = three.LoaderUtils.decodeText( new Uint8Array( data ) );

	        }

	        var json = JSON.parse( content );

	        if ( json.extensionsUsed && json.extensionsUsed.indexOf( EXTENSIONS.KHR_MATERIALS_COMMON ) >= 0 ) {

	            extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ] = new GLTFMaterialsCommonExtension( json );

	        }

	        var parser = new GLTFParser( json, extensions, {

	            crossOrigin: this.crossOrigin,
	            manager: this.manager,
	            path: path || this.resourcePath || ''

	        } );

	        parser.parse( function ( scene, scenes, cameras, animations ) {

	            var glTF = {
	                "scene": scene,
	                "scenes": scenes,
	                "cameras": cameras,
	                "animations": animations
	            };

	            callback( glTF );

	        } );
	    }
	}

	function GLTFRegistry() {

	    var objects = {};

	    return	{

	        get: function ( key ) {

	            return objects[ key ];

	        },

	        add: function ( key, object ) {

	            objects[ key ] = object;

	        },

	        remove: function ( key ) {

	            delete objects[ key ];

	        },

	        removeAll: function () {

	            objects = {};

	        },

	        update: function ( scene, camera ) {

	            for ( var name in objects ) {

	                var object = objects[ name ];

	                if ( object.update ) {

	                    object.update( scene, camera );

	                }

	            }

	        }

	    };

	}

	class GLTFShader {
	    constructor ( targetNode, allNodes ) {

	        var boundUniforms = {};

	        // bind each uniform to its source node

	        var uniforms = targetNode.material.uniforms;

	        for ( var uniformId in uniforms ) {

	            var uniform = uniforms[ uniformId ];

	            if ( uniform.semantic ) {

	                var sourceNodeRef = uniform.node;

	                var sourceNode = targetNode;

	                if ( sourceNodeRef ) {

	                    sourceNode = allNodes[ sourceNodeRef ];

	                }

	                boundUniforms[ uniformId ] = {
	                    semantic: uniform.semantic,
	                    sourceNode: sourceNode,
	                    targetNode: targetNode,
	                    uniform: uniform
	                };

	            }

	        }

	        this.boundUniforms = boundUniforms;
	        this._m4 = new three.Matrix4();
	    }

	    update ( scene, camera ) {

			var boundUniforms = this.boundUniforms;

			for ( var name in boundUniforms ) {

				var boundUniform = boundUniforms[ name ];

				switch ( boundUniform.semantic ) {

					case "MODELVIEW":

						var m4 = boundUniform.uniform.value;
						m4.multiplyMatrices( camera.matrixWorldInverse, boundUniform.sourceNode.matrixWorld );
						break;

					case "MODELVIEWINVERSETRANSPOSE":

						var m3 = boundUniform.uniform.value;
						this._m4.multiplyMatrices( camera.matrixWorldInverse, boundUniform.sourceNode.matrixWorld );
						m3.getNormalMatrix( this._m4 );
						break;

					case "PROJECTION":

						var m4 = boundUniform.uniform.value;
						m4.copy( camera.projectionMatrix );
						break;

					case "JOINTMATRIX":

						var m4v = boundUniform.uniform.value;

						for ( var mi = 0; mi < m4v.length; mi ++ ) {

							// So it goes like this:
							// SkinnedMesh world matrix is already baked into MODELVIEW;
							// transform joints to local space,
							// then transform using joint's inverse
							m4v[ mi ]
								.getInverse( boundUniform.sourceNode.matrixWorld )
								.multiply( boundUniform.targetNode.skeleton.bones[ mi ].matrixWorld )
								.multiply( boundUniform.targetNode.skeleton.boneInverses[ mi ] )
								.multiply( boundUniform.targetNode.bindMatrix );

						}

						break;

					default :

						console.warn( "Unhandled shader semantic: " + boundUniform.semantic );
						break;

				}

			}
	    }


	}

	var EXTENSIONS = {
	    KHR_BINARY_GLTF: 'KHR_binary_glTF',
	    KHR_MATERIALS_COMMON: 'KHR_materials_common'
	};

	function GLTFMaterialsCommonExtension( json ) {

	    this.name = EXTENSIONS.KHR_MATERIALS_COMMON;

	    this.lights = {};

	    var extension = ( json.extensions && json.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ] ) || {};
	    var lights = extension.lights || {};

	    for ( var lightId in lights ) {

	        var light = lights[ lightId ];
	        var lightNode;

	        var lightParams = light[ light.type ];
	        var color = new three.Color().fromArray( lightParams.color );

	        switch ( light.type ) {

	            case "directional":
	                lightNode = new three.DirectionalLight( color );
	                lightNode.position.set( 0, 0, 1 );
	                break;

	            case "point":
	                lightNode = new three.PointLight( color );
	                break;

	            case "spot":
	                lightNode = new three.SpotLight( color );
	                lightNode.position.set( 0, 0, 1 );
	                break;

	            case "ambient":
	                lightNode = new three.AmbientLight( color );
	                break;

	        }

	        if ( lightNode ) {

	            this.lights[ lightId ] = lightNode;

	        }

	    }
	}

	var BINARY_EXTENSION_BUFFER_NAME = 'binary_glTF';

	var BINARY_EXTENSION_HEADER_DEFAULTS = { magic: 'glTF', version: 1, contentFormat: 0 };

	var BINARY_EXTENSION_HEADER_LENGTH = 20;

	class GLTFBinaryExtension {
	    constructor( data ) {

	        this.name = EXTENSIONS.KHR_BINARY_GLTF;

	        var headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );

	        var header = {
	            magic: three.LoaderUtils.decodeText( new Uint8Array( data.slice( 0, 4 ) ) ),
	            version: headerView.getUint32( 4, true ),
	            length: headerView.getUint32( 8, true ),
	            contentLength: headerView.getUint32( 12, true ),
	            contentFormat: headerView.getUint32( 16, true )
	        };

	        for ( var key in BINARY_EXTENSION_HEADER_DEFAULTS ) {

	            var value = BINARY_EXTENSION_HEADER_DEFAULTS[ key ];

	            if ( header[ key ] !== value ) {

	                throw new Error( 'Unsupported glTF-Binary header: Expected "%s" to be "%s".', key, value );

	            }

	        }

	        var contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH, header.contentLength );

	        this.header = header;
	        this.content = three.LoaderUtils.decodeText( contentArray );
	        this.body = data.slice( BINARY_EXTENSION_HEADER_LENGTH + header.contentLength, header.length );
	    }

	    loadShader ( shader, bufferViews ) {

			var bufferView = bufferViews[ shader.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].bufferView ];
			var array = new Uint8Array( bufferView );

			return three.LoaderUtils.decodeText( array );

		};
	}

	var WEBGL_CONSTANTS = {
	    FLOAT: 5126,
	    //FLOAT_MAT2: 35674,
	    FLOAT_MAT3: 35675,
	    FLOAT_MAT4: 35676,
	    FLOAT_VEC2: 35664,
	    FLOAT_VEC3: 35665,
	    FLOAT_VEC4: 35666,
	    LINEAR: 9729,
	    REPEAT: 10497,
	    SAMPLER_2D: 35678,
	    TRIANGLES: 4,
	    LINES: 1,
	    UNSIGNED_BYTE: 5121,
	    UNSIGNED_SHORT: 5123,

	    VERTEX_SHADER: 35633,
	    FRAGMENT_SHADER: 35632
	};

	var WEBGL_TYPE = {
	    5126: Number,
	    //35674: Matrix2,
	    35675: three.Matrix3,
	    35676: three.Matrix4,
	    35664: three.Vector2,
	    35665: three.Vector3,
	    35666: three.Vector4,
	    35678: three.Texture
	};

	var WEBGL_COMPONENT_TYPES = {
	    5120: Int8Array,
	    5121: Uint8Array,
	    5122: Int16Array,
	    5123: Uint16Array,
	    5125: Uint32Array,
	    5126: Float32Array
	};

	var WEBGL_FILTERS = {
	    9728: three.NearestFilter,
	    9729: three.LinearFilter,
	    9984: three.NearestMipmapNearestFilter,
	    9985: three.LinearMipmapNearestFilter,
	    9986: three.NearestMipmapLinearFilter,
	    9987: three.LinearMipmapLinearFilter
	};

	var WEBGL_WRAPPINGS = {
	    33071: three.ClampToEdgeWrapping,
	    33648: three.MirroredRepeatWrapping,
	    10497: three.RepeatWrapping
	};

	var WEBGL_TEXTURE_FORMATS = {
	    6406: three.AlphaFormat,
	    6407: three.RGBFormat,
	    6408: three.RGBAFormat,
	    6409: three.LuminanceFormat,
	    6410: three.LuminanceAlphaFormat
	};

	var WEBGL_TEXTURE_DATATYPES = {
	    5121: three.UnsignedByteType,
	    32819: three.UnsignedShort4444Type,
	    32820: three.UnsignedShort5551Type,
	    33635: three.UnsignedShort565Type
	};

	var WEBGL_SIDES = {
	    1028: three.BackSide, // Culling front
	    1029: three.FrontSide // Culling back
	    //1032: NoSide   // Culling front and back, what to do?
	};

	var WEBGL_DEPTH_FUNCS = {
	    512: three.NeverDepth,
	    513: three.LessDepth,
	    514: three.EqualDepth,
	    515: three.LessEqualDepth,
	    516: three.GreaterEqualDepth,
	    517: three.NotEqualDepth,
	    518: three.GreaterEqualDepth,
	    519: three.AlwaysDepth
	};

	var WEBGL_BLEND_EQUATIONS = {
	    32774: three.AddEquation,
	    32778: three.SubtractEquation,
	    32779: three.ReverseSubtractEquation
	};

	var WEBGL_BLEND_FUNCS = {
	    0: three.ZeroFactor,
	    1: three.OneFactor,
	    768: three.SrcColorFactor,
	    769: three.OneMinusSrcColorFactor,
	    770: three.SrcAlphaFactor,
	    771: three.OneMinusSrcAlphaFactor,
	    772: three.DstAlphaFactor,
	    773: three.OneMinusDstAlphaFactor,
	    774: three.DstColorFactor,
	    775: three.OneMinusDstColorFactor,
	    776: three.SrcAlphaSaturateFactor
	    // The followings are not supported by js yet
	    //32769: CONSTANT_COLOR,
	    //32770: ONE_MINUS_CONSTANT_COLOR,
	    //32771: CONSTANT_ALPHA,
	    //32772: ONE_MINUS_CONSTANT_COLOR
	};

	var WEBGL_TYPE_SIZES = {
	    'SCALAR': 1,
	    'VEC2': 2,
	    'VEC3': 3,
	    'VEC4': 4,
	    'MAT2': 4,
	    'MAT3': 9,
	    'MAT4': 16
	};

	var PATH_PROPERTIES = {
	    scale: 'scale',
	    translation: 'position',
	    rotation: 'quaternion'
	};

	var INTERPOLATION = {
	    LINEAR: three.InterpolateLinear,
	    STEP: three.InterpolateDiscrete
	};

	var STATES_ENABLES = {
	    2884: 'CULL_FACE',
	    2929: 'DEPTH_TEST',
	    3042: 'BLEND',
	    3089: 'SCISSOR_TEST',
	    32823: 'POLYGON_OFFSET_FILL',
	    32926: 'SAMPLE_ALPHA_TO_COVERAGE'
	};

	function _each( object, callback, thisObj ) {

	    if ( ! object ) {

	        return Promise.resolve();

	    }

	    var results;
	    var fns = [];

	    if ( Object.prototype.toString.call( object ) === '[object Array]' ) {

	        results = [];

	        var length = object.length;

	        for ( var idx = 0; idx < length; idx ++ ) {

	            var value = callback.call( thisObj || this, object[ idx ], idx );

	            if ( value ) {

	                fns.push( value );

	                if ( value instanceof Promise ) {

	                    value.then( function ( key, value ) {

	                        results[ key ] = value;

	                    }.bind( this, idx ) );

	                } else {

	                    results[ idx ] = value;

	                }

	            }

	        }

	    } else {

	        results = {};

	        for ( var key in object ) {

	            if ( object.hasOwnProperty( key ) ) {

	                var value = callback.call( thisObj || this, object[ key ], key );

	                if ( value ) {

	                    fns.push( value );

	                    if ( value instanceof Promise ) {

	                        value.then( function ( key, value ) {

	                            results[ key ] = value;

	                        }.bind( this, key ) );

	                    } else {

	                        results[ key ] = value;

	                    }

	                }

	            }

	        }

	    }

	    return Promise.all( fns ).then( function () {

	        return results;

	    } );

	}

	function resolveURL( url, path ) {

	    // Invalid URL
	    if ( typeof url !== 'string' || url === '' )
	        return '';

	    // Absolute URL http://,https://,//
	    if ( /^(https?:)?\/\//i.test( url ) ) {

	        return url;

	    }

	    // Data URI
	    if ( /^data:.*,.*$/i.test( url ) ) {

	        return url;

	    }

	    // Blob URL
	    if ( /^blob:.*$/i.test( url ) ) {

	        return url;

	    }

	    // Relative URL
	    return ( path || '' ) + url;

	}

	// js seems too dependent on attribute names so globally
	// replace those in the shader code
	function replaceTHREEShaderAttributes( shaderText, technique ) {

	    // Expected technique attributes
	    var attributes = {};

	    for ( var attributeId in technique.attributes ) {

	        var pname = technique.attributes[ attributeId ];

	        var param = technique.parameters[ pname ];
	        var atype = param.type;
	        var semantic = param.semantic;

	        attributes[ attributeId ] = {
	            type: atype,
	            semantic: semantic
	        };

	    }

	    // Figure out which attributes to change in technique

	    var shaderParams = technique.parameters;
	    var shaderAttributes = technique.attributes;
	    var params = {};

	    for ( var attributeId in attributes ) {

	        var pname = shaderAttributes[ attributeId ];
	        var shaderParam = shaderParams[ pname ];
	        var semantic = shaderParam.semantic;
	        if ( semantic ) {

	            params[ attributeId ] = shaderParam;

	        }

	    }

	    for ( var pname in params ) {

	        var param = params[ pname ];
	        var semantic = param.semantic;

	        var regEx = new RegExp( "\\b" + pname + "\\b", "g" );

	        switch ( semantic ) {

	            case "POSITION":

	                shaderText = shaderText.replace( regEx, 'position' );
	                break;

	            case "NORMAL":

	                shaderText = shaderText.replace( regEx, 'normal' );
	                break;

	            case 'TEXCOORD_0':
	            case 'TEXCOORD0':
	            case 'TEXCOORD':

	                shaderText = shaderText.replace( regEx, 'uv' );
	                break;

	            case 'TEXCOORD_1':

	                shaderText = shaderText.replace( regEx, 'uv2' );
	                break;

	            case 'COLOR_0':
	            case 'COLOR0':
	            case 'COLOR':

	                shaderText = shaderText.replace( regEx, 'color' );
	                break;

	            case "WEIGHT":

	                shaderText = shaderText.replace( regEx, 'skinWeight' );
	                break;

	            case "JOINT":

	                shaderText = shaderText.replace( regEx, 'skinIndex' );
	                break;

	        }

	    }

	    return shaderText;

	}

	function createDefaultMaterial() {

	    return new three.MeshPhongMaterial( {
	        color: 0x00000,
	        emissive: 0x888888,
	        specular: 0x000000,
	        shininess: 0,
	        transparent: false,
	        depthTest: true,
	        side: three.FrontSide
	    } );

	}

	class DeferredShaderMaterial {
	    constructor( params ) {
	        this.isDeferredShaderMaterial = true;

	        this.params = params;
	    }

	    create() {

	        var uniforms = three.UniformsUtils.clone( this.params.uniforms );

	        for ( var uniformId in this.params.uniforms ) {

	            var originalUniform = this.params.uniforms[ uniformId ];

	            if ( originalUniform.value instanceof three.Texture ) {

	                uniforms[ uniformId ].value = originalUniform.value;
	                uniforms[ uniformId ].value.needsUpdate = true;

	            }

	            uniforms[ uniformId ].semantic = originalUniform.semantic;
	            uniforms[ uniformId ].node = originalUniform.node;

	        }

	        this.params.uniforms = uniforms;

	        return new three.RawShaderMaterial( this.params );
	    }
	}

	class GLTFParser {
	    constructor( json, extensions, options ) {
	        this.json = json || {};
	        this.extensions = extensions || {};
	        this.options = options || {};

	        // loader object cache
	        this.cache = new GLTFRegistry();
	    }

	    _withDependencies( dependencies ) {

			var _dependencies = {};

			for ( var i = 0; i < dependencies.length; i ++ ) {

				var dependency = dependencies[ i ];
				var fnName = "load" + dependency.charAt( 0 ).toUpperCase() + dependency.slice( 1 );

				var cached = this.cache.get( dependency );

				if ( cached !== undefined ) {

					_dependencies[ dependency ] = cached;

				} else if ( this[ fnName ] ) {

					var fn = this[ fnName ]();
					this.cache.add( dependency, fn );

					_dependencies[ dependency ] = fn;

				}

			}

			return _each( _dependencies, function ( dependency ) {

				return dependency;

			} );

		};

		parse( callback ) {

			var json = this.json;

			// Clear the loader cache
			this.cache.removeAll();

			// Fire the callback on complete
			this._withDependencies( [

				"scenes",
				"cameras",
				"animations"

			] ).then( function ( dependencies ) {

				var scenes = [];

				for ( var name in dependencies.scenes ) {

					scenes.push( dependencies.scenes[ name ] );

				}

				var scene = json.scene !== undefined ? dependencies.scenes[ json.scene ] : scenes[ 0 ];

				var cameras = [];

				for ( var name in dependencies.cameras ) {

					var camera = dependencies.cameras[ name ];
					cameras.push( camera );

				}

				var animations = [];

				for ( var name in dependencies.animations ) {

					animations.push( dependencies.animations[ name ] );

				}

				callback( scene, scenes, cameras, animations );

			} );

		};

		loadShaders() {

			var json = this.json;
			var extensions = this.extensions;
			var options = this.options;

			return this._withDependencies( [

				"bufferViews"

			] ).then( function ( dependencies ) {

				return _each( json.shaders, function ( shader ) {

					if ( shader.extensions && shader.extensions[ EXTENSIONS.KHR_BINARY_GLTF ] ) {

						return extensions[ EXTENSIONS.KHR_BINARY_GLTF ].loadShader( shader, dependencies.bufferViews );

					}

					return new Promise( function ( resolve ) {

						var loader = new three.FileLoader( options.manager );
						loader.setResponseType( 'text' );
						loader.load( resolveURL( shader.uri, options.path ), function ( shaderText ) {

							resolve( shaderText );

						} );

					} );

				} );

			} );

		};

		loadBuffers() {
			var json = this.json;
			var extensions = this.extensions;
			var options = this.options;

			return _each( json.buffers, function ( buffer, name ) {

				if ( name === BINARY_EXTENSION_BUFFER_NAME ) {

					return extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body;

				}

				if ( buffer.type === 'arraybuffer' || buffer.type === undefined ) {

					return new Promise( function ( resolve ) {

						var loader = new three.FileLoader( options.manager );
						loader.setResponseType( 'arraybuffer' );
						loader.load( resolveURL( buffer.uri, options.path ), function ( buffer ) {

							resolve( buffer );

						} );

					} );

				} else {

					console.warn( 'THREE.LegacyGLTFLoader: ' + buffer.type + ' buffer type is not supported' );

				}

			} );

		};

		loadBufferViews() {

			var json = this.json;

			return this._withDependencies( [

				"buffers"

			] ).then( function ( dependencies ) {

				return _each( json.bufferViews, function ( bufferView ) {

					var arraybuffer = dependencies.buffers[ bufferView.buffer ];

					var byteLength = bufferView.byteLength !== undefined ? bufferView.byteLength : 0;

					return arraybuffer.slice( bufferView.byteOffset, bufferView.byteOffset + byteLength );

				} );

			} );

		};

		loadAccessors() {

			var json = this.json;

			return this._withDependencies( [

				"bufferViews"

			] ).then( function ( dependencies ) {

				return _each( json.accessors, function ( accessor ) {

					var arraybuffer = dependencies.bufferViews[ accessor.bufferView ];
					var itemSize = WEBGL_TYPE_SIZES[ accessor.type ];
					var TypedArray = WEBGL_COMPONENT_TYPES[ accessor.componentType ];

					// For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
					var elementBytes = TypedArray.BYTES_PER_ELEMENT;
					var itemBytes = elementBytes * itemSize;

					// The buffer is not interleaved if the stride is the item size in bytes.
					if ( accessor.byteStride && accessor.byteStride !== itemBytes ) {

						// Use the full buffer if it's interleaved.
						var array = new TypedArray( arraybuffer );

						// Integer parameters to IB/IBA are in array elements, not bytes.
						var ib = new three.InterleavedBuffer( array, accessor.byteStride / elementBytes );

						return new three.InterleavedBufferAttribute( ib, itemSize, accessor.byteOffset / elementBytes );

					} else {

						array = new TypedArray( arraybuffer, accessor.byteOffset, accessor.count * itemSize );

						return new three.BufferAttribute( array, itemSize );

					}

				} );

			} );

		};

		loadTextures() {

			var json = this.json;
			var options = this.options;

			return this._withDependencies( [

				"bufferViews"

			] ).then( function ( dependencies ) {

				return _each( json.textures, function ( texture ) {

					if ( texture.source ) {

						return new Promise( function ( resolve ) {

							var source = json.images[ texture.source ];
							var sourceUri = source.uri;
							var isObjectURL = false;

							if ( source.extensions && source.extensions[ EXTENSIONS.KHR_BINARY_GLTF ] ) {

								var metadata = source.extensions[ EXTENSIONS.KHR_BINARY_GLTF ];
								var bufferView = dependencies.bufferViews[ metadata.bufferView ];
								var blob = new Blob( [ bufferView ], { type: metadata.mimeType } );
								sourceUri = URL.createObjectURL( blob );
								isObjectURL = true;

							}

							var textureLoader = options.manager.getHandler( sourceUri );

							if ( textureLoader === null ) {

								textureLoader = new three.TextureLoader( options.manager );

							}

							textureLoader.setCrossOrigin( options.crossOrigin );

							textureLoader.load( resolveURL( sourceUri, options.path ), function ( _texture ) {

								if ( isObjectURL ) URL.revokeObjectURL( sourceUri );

								_texture.flipY = false;

								if ( texture.name !== undefined ) _texture.name = texture.name;

								_texture.format = texture.format !== undefined ? WEBGL_TEXTURE_FORMATS[ texture.format ] : three.RGBAFormat;

								if ( texture.internalFormat !== undefined && _texture.format !== WEBGL_TEXTURE_FORMATS[ texture.internalFormat ] ) {

									console.warn( 'THREE.LegacyGLTFLoader: Three.js doesn\'t support texture internalFormat which is different from texture format. ' +
																'internalFormat will be forced to be the same value as format.' );

								}

								_texture.type = texture.type !== undefined ? WEBGL_TEXTURE_DATATYPES[ texture.type ] : three.UnsignedByteType;

								if ( texture.sampler ) {

									var sampler = json.samplers[ texture.sampler ];

									_texture.magFilter = WEBGL_FILTERS[ sampler.magFilter ] || three.LinearFilter;
									_texture.minFilter = WEBGL_FILTERS[ sampler.minFilter ] || three.NearestMipmapLinearFilter;
									_texture.wrapS = WEBGL_WRAPPINGS[ sampler.wrapS ] || three.RepeatWrapping;
									_texture.wrapT = WEBGL_WRAPPINGS[ sampler.wrapT ] || three.RepeatWrapping;

								}

								resolve( _texture );

							}, undefined, function () {

								if ( isObjectURL ) URL.revokeObjectURL( sourceUri );

								resolve();

							} );

						} );

					}

				} );

			} );

		};

	    loadMaterials() {

			var json = this.json;

			return this._withDependencies( [

				"shaders",
				"textures"

			] ).then( function ( dependencies ) {

				return _each( json.materials, function ( material ) {

					var materialType;
					var materialValues = {};
					var materialParams = {};

					var khr_material;

					if ( material.extensions && material.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ] ) {

						khr_material = material.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ];

					}

					if ( khr_material ) {

						// don't copy over unused values to avoid material warning spam
						var keys = [ 'ambient', 'emission', 'transparent', 'transparency', 'doubleSided' ];

						switch ( khr_material.technique ) {

							case 'BLINN' :
							case 'PHONG' :
								materialType = three.MeshPhongMaterial;
								keys.push( 'diffuse', 'specular', 'shininess' );
								break;

							case 'LAMBERT' :
								materialType = three.MeshLambertMaterial;
								keys.push( 'diffuse' );
								break;

							case 'CONSTANT' :
							default :
								materialType = three.MeshBasicMaterial;
								break;

						}

						keys.forEach( function ( v ) {

							if ( khr_material.values[ v ] !== undefined ) materialValues[ v ] = khr_material.values[ v ];

						} );

						if ( khr_material.doubleSided || materialValues.doubleSided ) {

							materialParams.side = three.DoubleSide;

						}

						if ( khr_material.transparent || materialValues.transparent ) {

							materialParams.transparent = true;
							materialParams.opacity = ( materialValues.transparency !== undefined ) ? materialValues.transparency : 1;

						}

					} else if ( material.technique === undefined ) {

						materialType = three.MeshPhongMaterial;

						Object.assign( materialValues, material.values );

					} else {

						materialType = DeferredShaderMaterial;

						var technique = json.techniques[ material.technique ];

						materialParams.uniforms = {};

						var program = json.programs[ technique.program ];

						if ( program ) {

							materialParams.fragmentShader = dependencies.shaders[ program.fragmentShader ];

							if ( ! materialParams.fragmentShader ) {

								console.warn( "ERROR: Missing fragment shader definition:", program.fragmentShader );
								materialType = three.MeshPhongMaterial;

							}

							var vertexShader = dependencies.shaders[ program.vertexShader ];

							if ( ! vertexShader ) {

								console.warn( "ERROR: Missing vertex shader definition:", program.vertexShader );
								materialType = three.MeshPhongMaterial;

							}

							// IMPORTANT: FIX VERTEX SHADER ATTRIBUTE DEFINITIONS
							materialParams.vertexShader = replaceTHREEShaderAttributes( vertexShader, technique );

							var uniforms = technique.uniforms;

							for ( var uniformId in uniforms ) {

								var pname = uniforms[ uniformId ];
								var shaderParam = technique.parameters[ pname ];

								var ptype = shaderParam.type;

								if ( WEBGL_TYPE[ ptype ] ) {

									var pcount = shaderParam.count;
									var value;

									if ( material.values !== undefined ) value = material.values[ pname ];

									var uvalue = new WEBGL_TYPE[ ptype ]();
									var usemantic = shaderParam.semantic;
									var unode = shaderParam.node;

									switch ( ptype ) {

										case WEBGL_CONSTANTS.FLOAT:

											uvalue = shaderParam.value;

											if ( pname == "transparency" ) {

												materialParams.transparent = true;

											}

											if ( value !== undefined ) {

												uvalue = value;

											}

											break;

										case WEBGL_CONSTANTS.FLOAT_VEC2:
										case WEBGL_CONSTANTS.FLOAT_VEC3:
										case WEBGL_CONSTANTS.FLOAT_VEC4:
										case WEBGL_CONSTANTS.FLOAT_MAT3:

											if ( shaderParam && shaderParam.value ) {

												uvalue.fromArray( shaderParam.value );

											}

											if ( value ) {

												uvalue.fromArray( value );

											}

											break;

										case WEBGL_CONSTANTS.FLOAT_MAT2:

											// what to do?
											console.warn( "FLOAT_MAT2 is not a supported uniform type" );
											break;

										case WEBGL_CONSTANTS.FLOAT_MAT4:

											if ( pcount ) {

												uvalue = new Array( pcount );

												for ( var mi = 0; mi < pcount; mi ++ ) {

													uvalue[ mi ] = new WEBGL_TYPE[ ptype ]();

												}

												if ( shaderParam && shaderParam.value ) {

													var m4v = shaderParam.value;
													uvalue.fromArray( m4v );

												}

												if ( value ) {

													uvalue.fromArray( value );

												}

											} else {

												if ( shaderParam && shaderParam.value ) {

													var m4 = shaderParam.value;
													uvalue.fromArray( m4 );

												}

												if ( value ) {

													uvalue.fromArray( value );

												}

											}

											break;

										case WEBGL_CONSTANTS.SAMPLER_2D:

											if ( value !== undefined ) {

												uvalue = dependencies.textures[ value ];

											} else if ( shaderParam.value !== undefined ) {

												uvalue = dependencies.textures[ shaderParam.value ];

											} else {

												uvalue = null;

											}

											break;

									}

									materialParams.uniforms[ uniformId ] = {
										value: uvalue,
										semantic: usemantic,
										node: unode
									};

								} else {

									throw new Error( "Unknown shader uniform param type: " + ptype );

								}

							}

							var states = technique.states || {};
							var enables = states.enable || [];
							var functions = states.functions || {};

							var enableCullFace = false;
							var enableDepthTest = false;
							var enableBlend = false;

							for ( var i = 0, il = enables.length; i < il; i ++ ) {

								var enable = enables[ i ];

								switch ( STATES_ENABLES[ enable ] ) {

									case 'CULL_FACE':

										enableCullFace = true;

										break;

									case 'DEPTH_TEST':

										enableDepthTest = true;

										break;

									case 'BLEND':

										enableBlend = true;

										break;

									// TODO: implement
									case 'SCISSOR_TEST':
									case 'POLYGON_OFFSET_FILL':
									case 'SAMPLE_ALPHA_TO_COVERAGE':

										break;

									default:

										throw new Error( "Unknown technique.states.enable: " + enable );

								}

							}

							if ( enableCullFace ) {

								materialParams.side = functions.cullFace !== undefined ? WEBGL_SIDES[ functions.cullFace ] : three.FrontSide;

							} else {

								materialParams.side = three.DoubleSide;

							}

							materialParams.depthTest = enableDepthTest;
							materialParams.depthFunc = functions.depthFunc !== undefined ? WEBGL_DEPTH_FUNCS[ functions.depthFunc ] : three.LessDepth;
							materialParams.depthWrite = functions.depthMask !== undefined ? functions.depthMask[ 0 ] : true;

							materialParams.blending = enableBlend ? three.CustomBlending : three.NoBlending;
							materialParams.transparent = enableBlend;

							var blendEquationSeparate = functions.blendEquationSeparate;

							if ( blendEquationSeparate !== undefined ) {

								materialParams.blendEquation = WEBGL_BLEND_EQUATIONS[ blendEquationSeparate[ 0 ] ];
								materialParams.blendEquationAlpha = WEBGL_BLEND_EQUATIONS[ blendEquationSeparate[ 1 ] ];

							} else {

								materialParams.blendEquation = three.AddEquation;
								materialParams.blendEquationAlpha = three.AddEquation;

							}

							var blendFuncSeparate = functions.blendFuncSeparate;

							if ( blendFuncSeparate !== undefined ) {

								materialParams.blendSrc = WEBGL_BLEND_FUNCS[ blendFuncSeparate[ 0 ] ];
								materialParams.blendDst = WEBGL_BLEND_FUNCS[ blendFuncSeparate[ 1 ] ];
								materialParams.blendSrcAlpha = WEBGL_BLEND_FUNCS[ blendFuncSeparate[ 2 ] ];
								materialParams.blendDstAlpha = WEBGL_BLEND_FUNCS[ blendFuncSeparate[ 3 ] ];

							} else {

								materialParams.blendSrc = three.OneFactor;
								materialParams.blendDst = three.ZeroFactor;
								materialParams.blendSrcAlpha = three.OneFactor;
								materialParams.blendDstAlpha = three.ZeroFactor;

							}

						}

					}

					if ( Array.isArray( materialValues.diffuse ) ) {

						materialParams.color = new three.Color().fromArray( materialValues.diffuse );

					} else if ( typeof ( materialValues.diffuse ) === 'string' ) {

						materialParams.map = dependencies.textures[ materialValues.diffuse ];

					}

					delete materialParams.diffuse;

					if ( typeof ( materialValues.reflective ) === 'string' ) {

						materialParams.envMap = dependencies.textures[ materialValues.reflective ];

					}

					if ( typeof ( materialValues.bump ) === 'string' ) {

						materialParams.bumpMap = dependencies.textures[ materialValues.bump ];

					}

					if ( Array.isArray( materialValues.emission ) ) {

						if ( materialType === three.MeshBasicMaterial ) {

							materialParams.color = new three.Color().fromArray( materialValues.emission );

						} else {

							materialParams.emissive = new three.Color().fromArray( materialValues.emission );

						}

					} else if ( typeof ( materialValues.emission ) === 'string' ) {

						if ( materialType === three.MeshBasicMaterial ) {

							materialParams.map = dependencies.textures[ materialValues.emission ];

						} else {

							materialParams.emissiveMap = dependencies.textures[ materialValues.emission ];

						}

					}

					if ( Array.isArray( materialValues.specular ) ) {

						materialParams.specular = new three.Color().fromArray( materialValues.specular );

					} else if ( typeof ( materialValues.specular ) === 'string' ) {

						materialParams.specularMap = dependencies.textures[ materialValues.specular ];

					}

					if ( materialValues.shininess !== undefined ) {

						materialParams.shininess = materialValues.shininess;

					}

					var _material = new materialType( materialParams );
					if ( material.name !== undefined ) _material.name = material.name;

					return _material;

				} );

			} );

		};

		loadMeshes() {

			var json = this.json;

			return this._withDependencies( [

				"accessors",
				"materials"

			] ).then( function ( dependencies ) {

				return _each( json.meshes, function ( mesh ) {

					var group = new three.Group();
					if ( mesh.name !== undefined ) group.name = mesh.name;

					if ( mesh.extras ) group.userData = mesh.extras;

					var primitives = mesh.primitives || [];

					for ( var name in primitives ) {

						var primitive = primitives[ name ];

						if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === undefined ) {

							var geometry = new three.BufferGeometry();

							var attributes = primitive.attributes;

							for ( var attributeId in attributes ) {

								var attributeEntry = attributes[ attributeId ];

								if ( ! attributeEntry ) return;

								var bufferAttribute = dependencies.accessors[ attributeEntry ];

								switch ( attributeId ) {

									case 'POSITION':
										geometry.setAttribute( 'position', bufferAttribute );
										break;

									case 'NORMAL':
										geometry.setAttribute( 'normal', bufferAttribute );
										break;

									case 'TEXCOORD_0':
									case 'TEXCOORD0':
									case 'TEXCOORD':
										geometry.setAttribute( 'uv', bufferAttribute );
										break;

									case 'TEXCOORD_1':
										geometry.setAttribute( 'uv2', bufferAttribute );
										break;

									case 'COLOR_0':
									case 'COLOR0':
									case 'COLOR':
										geometry.setAttribute( 'color', bufferAttribute );
										break;

									case 'WEIGHT':
										geometry.setAttribute( 'skinWeight', bufferAttribute );
										break;

									case 'JOINT':
										geometry.setAttribute( 'skinIndex', bufferAttribute );
										break;

									default:

										if ( ! primitive.material ) break;

										var material = json.materials[ primitive.material ];

										if ( ! material.technique ) break;

										var parameters = json.techniques[ material.technique ].parameters || {};

										for ( var attributeName in parameters ) {

											if ( parameters[ attributeName ][ 'semantic' ] === attributeId ) {

												geometry.setAttribute( attributeName, bufferAttribute );

											}

										}

								}

							}

							if ( primitive.indices ) {

								geometry.setIndex( dependencies.accessors[ primitive.indices ] );

							}

							var material = dependencies.materials !== undefined ? dependencies.materials[ primitive.material ] : createDefaultMaterial();

							var meshNode = new three.Mesh( geometry, material );
							meshNode.castShadow = true;
							meshNode.name = ( name === "0" ? group.name : group.name + name );

							if ( primitive.extras ) meshNode.userData = primitive.extras;

							group.add( meshNode );

						} else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

							var geometry = new three.BufferGeometry();

							var attributes = primitive.attributes;

							for ( var attributeId in attributes ) {

								var attributeEntry = attributes[ attributeId ];

								if ( ! attributeEntry ) return;

								var bufferAttribute = dependencies.accessors[ attributeEntry ];

								switch ( attributeId ) {

									case 'POSITION':
										geometry.setAttribute( 'position', bufferAttribute );
										break;

									case 'COLOR_0':
									case 'COLOR0':
									case 'COLOR':
										geometry.setAttribute( 'color', bufferAttribute );
										break;

								}

							}

							var material = dependencies.materials[ primitive.material ];

							var meshNode;

							if ( primitive.indices ) {

								geometry.setIndex( dependencies.accessors[ primitive.indices ] );

								meshNode = new three.LineSegments( geometry, material );

							} else {

								meshNode = new three.Line( geometry, material );

							}

							meshNode.name = ( name === "0" ? group.name : group.name + name );

							if ( primitive.extras ) meshNode.userData = primitive.extras;

							group.add( meshNode );

						} else {

							console.warn( "Only triangular and line primitives are supported" );

						}

					}

					return group;

				} );

			} );

		};

		loadCameras() {

			var json = this.json;

			return _each( json.cameras, function ( camera ) {

				if ( camera.type == "perspective" && camera.perspective ) {

					var yfov = camera.perspective.yfov;
					var aspectRatio = camera.perspective.aspectRatio !== undefined ? camera.perspective.aspectRatio : 1;

					// According to COLLADA spec...
					// aspectRatio = xfov / yfov
					var xfov = yfov * aspectRatio;

					var _camera = new three.PerspectiveCamera( three.Math.radToDeg( xfov ), aspectRatio, camera.perspective.znear || 1, camera.perspective.zfar || 2e6 );
					if ( camera.name !== undefined ) _camera.name = camera.name;

					if ( camera.extras ) _camera.userData = camera.extras;

					return _camera;

				} else if ( camera.type == "orthographic" && camera.orthographic ) {

					var _camera = new three.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, camera.orthographic.znear, camera.orthographic.zfar );
					if ( camera.name !== undefined ) _camera.name = camera.name;

					if ( camera.extras ) _camera.userData = camera.extras;

					return _camera;

				}

			} );

		};

		loadSkins() {

			var json = this.json;

			return this._withDependencies( [

				"accessors"

			] ).then( function ( dependencies ) {

				return _each( json.skins, function ( skin ) {

					var bindShapeMatrix = new three.Matrix4();

					if ( skin.bindShapeMatrix !== undefined ) bindShapeMatrix.fromArray( skin.bindShapeMatrix );

					var _skin = {
						bindShapeMatrix: bindShapeMatrix,
						jointNames: skin.jointNames,
						inverseBindMatrices: dependencies.accessors[ skin.inverseBindMatrices ]
					};

					return _skin;

				} );

			} );

		};

		loadAnimations() {

			var json = this.json;

			return this._withDependencies( [

				"accessors",
				"nodes"

			] ).then( function ( dependencies ) {

				return _each( json.animations, function ( animation, animationId ) {

					var tracks = [];

					for ( var channelId in animation.channels ) {

						var channel = animation.channels[ channelId ];
						var sampler = animation.samplers[ channel.sampler ];

						if ( sampler ) {

							var target = channel.target;
							var name = target.id;
							var input = animation.parameters !== undefined ? animation.parameters[ sampler.input ] : sampler.input;
							var output = animation.parameters !== undefined ? animation.parameters[ sampler.output ] : sampler.output;

							var inputAccessor = dependencies.accessors[ input ];
							var outputAccessor = dependencies.accessors[ output ];

							var node = dependencies.nodes[ name ];

							if ( node ) {

								node.updateMatrix();
								node.matrixAutoUpdate = true;

								var TypedKeyframeTrack = PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.rotation
									? three.QuaternionKeyframeTrack
									: three.VectorKeyframeTrack;

								var targetName = node.name ? node.name : node.uuid;
								var interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : three.InterpolateLinear;

								// KeyframeTrack.optimize() will modify given 'times' and 'values'
								// buffers before creating a truncated copy to keep. Because buffers may
								// be reused by other tracks, make copies here.
								tracks.push( new TypedKeyframeTrack(
									targetName + '.' + PATH_PROPERTIES[ target.path ],
									three.AnimationUtils.arraySlice( inputAccessor.array, 0 ),
									three.AnimationUtils.arraySlice( outputAccessor.array, 0 ),
									interpolation
								) );

							}

						}

					}

					var name = animation.name !== undefined ? animation.name : "animation_" + animationId;

					return new three.AnimationClip( name, undefined, tracks );

				} );

			} );

		};

		loadNodes() {

			var json = this.json;
			var extensions = this.extensions;
			var scope = this;

			return _each( json.nodes, function ( node ) {

				var matrix = new three.Matrix4();

				var _node;

				if ( node.jointName ) {

					_node = new three.Bone();
					_node.name = node.name !== undefined ? node.name : node.jointName;
					_node.jointName = node.jointName;

				} else {

					_node = new three.Object3D();
					if ( node.name !== undefined ) _node.name = node.name;

				}

				if ( node.extras ) _node.userData = node.extras;

				if ( node.matrix !== undefined ) {

					matrix.fromArray( node.matrix );
					_node.applyMatrix4( matrix );

				} else {

					if ( node.translation !== undefined ) {

						_node.position.fromArray( node.translation );

					}

					if ( node.rotation !== undefined ) {

						_node.quaternion.fromArray( node.rotation );

					}

					if ( node.scale !== undefined ) {

						_node.scale.fromArray( node.scale );

					}

				}

				return _node;

			} ).then( function ( __nodes ) {

				return scope._withDependencies( [

					"meshes",
					"skins",
					"cameras"

				] ).then( function ( dependencies ) {

					return _each( __nodes, function ( _node, nodeId ) {

						var node = json.nodes[ nodeId ];

						if ( node.meshes !== undefined ) {

							for ( var meshId in node.meshes ) {

								var mesh = node.meshes[ meshId ];
								var group = dependencies.meshes[ mesh ];

								if ( group === undefined ) {

									console.warn( 'LegacyGLTFLoader: Couldn\'t find node "' + mesh + '".' );
									continue;

								}

								for ( var childrenId in group.children ) {

									var child = group.children[ childrenId ];

									// clone Mesh to add to _node

									var originalMaterial = child.material;
									var originalGeometry = child.geometry;
									var originalUserData = child.userData;
									var originalName = child.name;

									var material;

									if ( originalMaterial.isDeferredShaderMaterial ) {

										originalMaterial = material = originalMaterial.create();

									} else {

										material = originalMaterial;

									}

									switch ( child.type ) {

										case 'LineSegments':
											child = new three.LineSegments( originalGeometry, material );
											break;

										case 'LineLoop':
											child = new three.LineLoop( originalGeometry, material );
											break;

										case 'Line':
											child = new three.Line( originalGeometry, material );
											break;

										default:
											child = new three.Mesh( originalGeometry, material );

									}

									child.castShadow = true;
									child.userData = originalUserData;
									child.name = originalName;

									var skinEntry;

									if ( node.skin ) {

										skinEntry = dependencies.skins[ node.skin ];

									}

									// Replace Mesh with SkinnedMesh in library
									if ( skinEntry ) {

										var getJointNode = function ( jointId ) {

											var keys = Object.keys( __nodes );

											for ( var i = 0, il = keys.length; i < il; i ++ ) {

												var n = __nodes[ keys[ i ] ];

												if ( n.jointName === jointId ) return n;

											}

											return null;

										};

										var geometry = originalGeometry;
										var material = originalMaterial;
										material.skinning = true;

										child = new three.SkinnedMesh( geometry, material );
										child.castShadow = true;
										child.userData = originalUserData;
										child.name = originalName;

										var bones = [];
										var boneInverses = [];

										for ( var i = 0, l = skinEntry.jointNames.length; i < l; i ++ ) {

											var jointId = skinEntry.jointNames[ i ];
											var jointNode = getJointNode( jointId );

											if ( jointNode ) {

												bones.push( jointNode );

												var m = skinEntry.inverseBindMatrices.array;
												var mat = new three.Matrix4().fromArray( m, i * 16 );
												boneInverses.push( mat );

											} else {

												console.warn( "WARNING: joint: '" + jointId + "' could not be found" );

											}

										}

										child.bind( new three.Skeleton( bones, boneInverses ), skinEntry.bindShapeMatrix );

										var buildBoneGraph = function ( parentJson, parentObject, property ) {

											var children = parentJson[ property ];

											if ( children === undefined ) return;

											for ( var i = 0, il = children.length; i < il; i ++ ) {

												var nodeId = children[ i ];
												var bone = __nodes[ nodeId ];
												var boneJson = json.nodes[ nodeId ];

												if ( bone !== undefined && bone.isBone === true && boneJson !== undefined ) {

													parentObject.add( bone );
													buildBoneGraph( boneJson, bone, 'children' );

												}

											}

										};

										buildBoneGraph( node, child, 'skeletons' );

									}

									_node.add( child );

								}

							}

						}

						if ( node.camera !== undefined ) {

							var camera = dependencies.cameras[ node.camera ];

							_node.add( camera );

						}

						if ( node.extensions
								 && node.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ]
								 && node.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ].light ) {

							var extensionLights = extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ].lights;
							var light = extensionLights[ node.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ].light ];

							_node.add( light );

						}

						return _node;

					} );

				} );

			} );

		};

		loadScenes() {

			var json = this.json;

			// scene node hierachy builder

			function buildNodeHierachy( nodeId, parentObject, allNodes ) {

				var _node = allNodes[ nodeId ];
				parentObject.add( _node );

				var node = json.nodes[ nodeId ];

				if ( node.children ) {

					var children = node.children;

					for ( var i = 0, l = children.length; i < l; i ++ ) {

						var child = children[ i ];
						buildNodeHierachy( child, _node, allNodes );

					}

				}

			}

			return this._withDependencies( [

				"nodes"

			] ).then( function ( dependencies ) {

				return _each( json.scenes, function ( scene ) {

					var _scene = new three.Scene();
					if ( scene.name !== undefined ) _scene.name = scene.name;

					if ( scene.extras ) _scene.userData = scene.extras;

					var nodes = scene.nodes || [];

					for ( var i = 0, l = nodes.length; i < l; i ++ ) {

						var nodeId = nodes[ i ];
						buildNodeHierachy( nodeId, _scene, dependencies.nodes );

					}

					_scene.traverse( function ( child ) {

						// Register raw material meshes with LegacyGLTFLoader.Shaders
						if ( child.material && child.material.isRawShaderMaterial ) {

							child.gltfShader = new GLTFShader( child, dependencies.nodes );
							child.onBeforeRender = function ( renderer, scene, camera ) {

								this.gltfShader.update( scene, camera );

							};

						}

					} );

					return _scene;

				} );

			} );

		};
	}

	// Copyright 2021 Icosa Gallery

	class TiltShaderLoader extends three.Loader {
	    constructor( manager ) {
	        super( manager );
	    }

	    async load(brushName, onLoad, onProgress, onError ) {
	        const scope = this;

	        const isAlreadyLoaded = loadedMaterials[brushName];

	        if (isAlreadyLoaded !== undefined) {
	            onLoad( scope.parse( isAlreadyLoaded ) );
	            return;
	        }

			const loader = new three.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'text' );
			loader.setWithCredentials( this.withCredentials );

	        const textureLoader = new three.TextureLoader(this.manager);
	        textureLoader.setPath(this.path);
	        textureLoader.setWithCredentials( this.withCredentials );

	        const materialParams = tiltBrushMaterialParams[brushName];

	        materialParams.vertexShader = await loader.loadAsync(materialParams.vertexShader);
	        materialParams.fragmentShader = await loader.loadAsync(materialParams.fragmentShader);

	        if (materialParams.uniforms.u_MainTex) {
	            const mainTex = await textureLoader.loadAsync(materialParams.uniforms.u_MainTex.value);
	            mainTex.name = `${brushName}_MainTex`;
	            mainTex.wrapS = three.RepeatWrapping;
	            mainTex.wrapT = three.RepeatWrapping;
	            mainTex.flipY = false;
	            materialParams.uniforms.u_MainTex.value = mainTex;
	        }

	        if (materialParams.uniforms.u_BumpMap) {
	            const bumpMap = await textureLoader.loadAsync(materialParams.uniforms.u_BumpMap.value);
	            bumpMap.name = `${brushName}_BumpMap`;
	            bumpMap.wrapS = three.RepeatWrapping;
	            bumpMap.wrapT = three.RepeatWrapping;
	            bumpMap.flipY = false;
	            materialParams.uniforms.u_BumpMap.value = bumpMap;
	        }

	        if (materialParams.uniforms.u_AlphaMask) {
	            const alphaMask = await textureLoader.loadAsync(materialParams.uniforms.u_AlphaMask.value);
	            alphaMask.name = `${brushName}_AlphaMask`;
	            alphaMask.wrapS = three.RepeatWrapping;
	            alphaMask.wrapT = three.RepeatWrapping;
	            alphaMask.flipY = false;
	            materialParams.uniforms.u_AlphaMask.value = alphaMask;
	        }

	        loadedMaterials[brushName] = materialParams;

	        onLoad( scope.parse( materialParams ) );
	    }

	    parse( materialParams ) {
	        return new three.RawShaderMaterial( materialParams );
	    }
	}

	const loadedMaterials = {};

	const tiltBrushMaterialParams = {
	    "BlocksBasic" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_Shininess: { value: 0.2 },
	            u_SpecColor: { value: new three.Vector3(0.1960784, 0.1960784, 0.1960784) },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "BlocksBasic-0e87b49c-6546-3a34-3a44-8a556d7d6c3e/BlocksBasic-0e87b49c-6546-3a34-3a44-8a556d7d6c3e-v10.0-vertex.glsl",
	        fragmentShader: "BlocksBasic-0e87b49c-6546-3a34-3a44-8a556d7d6c3e/BlocksBasic-0e87b49c-6546-3a34-3a44-8a556d7d6c3e-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "BlocksGem" : {
	        uniforms: {
	            u_SceneLight_0_matrix: {value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1]},
	            u_SceneLight_1_matrix: {value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1]},
	            u_ambient_light_color: {value: new three.Vector4(0.3922, 0.3922, 0.3922, 1)},
	            u_SceneLight_0_color: {value: new three.Vector4(0.7780, 0.8157, 0.9914, 1)},
	            u_SceneLight_1_color: {value: new three.Vector4(0.4282, 0.4212, 0.3459, 1)},
	            u_Color: { value: new three.Vector4(1, 1, 1, 1) },
	            u_Shininess: { value: 0.9 },
	            u_RimIntensity: { value: 0.5 },
	            u_RimPower: { value: 2 },
	            u_Frequency: { value: 2 },
	            u_Jitter: { value: 1 },
	            u_fogColor: {value: new three.Vector3(0.0196, 0.0196, 0.0196)},
	            u_fogDensity: {value: 0 }
	        },
	        vertexShader: "BlocksGem-232998f8-d357-47a2-993a-53415df9be10/BlocksGem-232998f8-d357-47a2-993a-53415df9be10-v10.0-vertex.glsl",
	        fragmentShader: "BlocksGem-232998f8-d357-47a2-993a-53415df9be10/BlocksGem-232998f8-d357-47a2-993a-53415df9be10-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "BlocksGlass" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_Color: { value: new three.Vector4(1, 1, 1, 1) },
	            u_Shininess: { value: 0.8 },
	            u_RimIntensity: { value: 0.7 },
	            u_RimPower: { value: 4 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "BlocksGlass-3d813d82-5839-4450-8ddc-8e889ecd96c7/BlocksGlass-3d813d82-5839-4450-8ddc-8e889ecd96c7-v10.0-vertex.glsl",
	        fragmentShader: "BlocksGlass-3d813d82-5839-4450-8ddc-8e889ecd96c7/BlocksGlass-3d813d82-5839-4450-8ddc-8e889ecd96c7-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 2
	    },
	    "Bubbles" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Bubbles-89d104cd-d012-426b-b5b3-bbaee63ac43c/Bubbles-89d104cd-d012-426b-b5b3-bbaee63ac43c-v10.0-MainTex.png" },
	        },
	        vertexShader: "Bubbles-89d104cd-d012-426b-b5b3-bbaee63ac43c/Bubbles-89d104cd-d012-426b-b5b3-bbaee63ac43c-v10.0-vertex.glsl",
	        fragmentShader: "Bubbles-89d104cd-d012-426b-b5b3-bbaee63ac43c/Bubbles-89d104cd-d012-426b-b5b3-bbaee63ac43c-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "CelVinyl" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_Cutoff: { value: 0.554 },
	            u_MainTex: { value: "CelVinyl-700f3aa8-9a7c-2384-8b8a-ea028905dd8c/CelVinyl-700f3aa8-9a7c-2384-8b8a-ea028905dd8c-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "CelVinyl-700f3aa8-9a7c-2384-8b8a-ea028905dd8c/CelVinyl-700f3aa8-9a7c-2384-8b8a-ea028905dd8c-v10.0-vertex.glsl",
	        fragmentShader: "CelVinyl-700f3aa8-9a7c-2384-8b8a-ea028905dd8c/CelVinyl-700f3aa8-9a7c-2384-8b8a-ea028905dd8c-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "ChromaticWave" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_time: { value: new three.Vector4() },
	            u_EmissionGain: { value: 0.45 },
	        },
	        vertexShader: "ChromaticWave-0f0ff7b2-a677-45eb-a7d6-0cd7206f4816/ChromaticWave-0f0ff7b2-a677-45eb-a7d6-0cd7206f4816-v10.0-vertex.glsl",
	        fragmentShader: "ChromaticWave-0f0ff7b2-a677-45eb-a7d6-0cd7206f4816/ChromaticWave-0f0ff7b2-a677-45eb-a7d6-0cd7206f4816-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "CoarseBristles" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_MainTex: { value: "CoarseBristles-1161af82-50cf-47db-9706-0c3576d43c43/CoarseBristles-1161af82-50cf-47db-9706-0c3576d43c43-v10.0-MainTex.png" },
	            u_Cutoff: { value: 0.25 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "CoarseBristles-1161af82-50cf-47db-9706-0c3576d43c43/CoarseBristles-1161af82-50cf-47db-9706-0c3576d43c43-v10.0-vertex.glsl",
	        fragmentShader: "CoarseBristles-1161af82-50cf-47db-9706-0c3576d43c43/CoarseBristles-1161af82-50cf-47db-9706-0c3576d43c43-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Comet" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Comet-1caa6d7d-f015-3f54-3a4b-8b5354d39f81/Comet-1caa6d7d-f015-3f54-3a4b-8b5354d39f81-v10.0-MainTex.png" },
	            u_AlphaMask: { value: "Comet-1caa6d7d-f015-3f54-3a4b-8b5354d39f81/Comet-1caa6d7d-f015-3f54-3a4b-8b5354d39f81-v10.0-AlphaMask.png" },
	            u_AlphaMask_TexelSize: { value: new three.Vector4(0.0156, 1, 64, 1)},
	            u_time: { value: new three.Vector4() },
	            u_Speed: { value: 1 },
	            u_EmissionGain: { value: 0.5 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "Comet-1caa6d7d-f015-3f54-3a4b-8b5354d39f81/Comet-1caa6d7d-f015-3f54-3a4b-8b5354d39f81-v10.0-vertex.glsl",
	        fragmentShader: "Comet-1caa6d7d-f015-3f54-3a4b-8b5354d39f81/Comet-1caa6d7d-f015-3f54-3a4b-8b5354d39f81-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "DiamondHull" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_MainTex: { value: "DiamondHull-c8313697-2563-47fc-832e-290f4c04b901/DiamondHull-c8313697-2563-47fc-832e-290f4c04b901-v10.0-MainTex.png" },
	            u_time: { value: new three.Vector4() },
	            cameraPosition: { value: new three.Vector3() },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "DiamondHull-c8313697-2563-47fc-832e-290f4c04b901/DiamondHull-c8313697-2563-47fc-832e-290f4c04b901-v10.0-vertex.glsl",
	        fragmentShader: "DiamondHull-c8313697-2563-47fc-832e-290f4c04b901/DiamondHull-c8313697-2563-47fc-832e-290f4c04b901-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "Disco" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_time: { value: new three.Vector4() },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_Shininess: { value: 0.65 },
	            u_SpecColor: { value: new three.Vector3(0.5147059, 0.5147059, 0.5147059) },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "Disco-4391aaaa-df73-4396-9e33-31e4e4930b27/Disco-4391aaaa-df73-4396-9e33-31e4e4930b27-v10.0-vertex.glsl",
	        fragmentShader: "Disco-4391aaaa-df73-4396-9e33-31e4e4930b27/Disco-4391aaaa-df73-4396-9e33-31e4e4930b27-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "DotMarker" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "DotMarker-d1d991f2-e7a0-4cf1-b328-f57e915e6260/DotMarker-d1d991f2-e7a0-4cf1-b328-f57e915e6260-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "DotMarker-d1d991f2-e7a0-4cf1-b328-f57e915e6260/DotMarker-d1d991f2-e7a0-4cf1-b328-f57e915e6260-v10.0-vertex.glsl",
	        fragmentShader: "DotMarker-d1d991f2-e7a0-4cf1-b328-f57e915e6260/DotMarker-d1d991f2-e7a0-4cf1-b328-f57e915e6260-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0,

	    },
	    "Dots" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Dots-6a1cf9f9-032c-45ec-9b1d-a6680bee30f7/Dots-6a1cf9f9-032c-45ec-9b1d-a6680bee30f7-v10.0-MainTex.png" },
	            u_TintColor: { value: new three.Vector4(1, 1, 1, 1) },
	            u_EmissionGain: { value: 300 },
	            u_BaseGain: { value: 0.4 }
	        },
	        vertexShader: "Dots-6a1cf9f9-032c-45ec-9b1d-a6680bee30f7/Dots-6a1cf9f9-032c-45ec-9b1d-a6680bee30f7-v10.0-vertex.glsl",
	        fragmentShader: "Dots-6a1cf9f9-032c-45ec-9b1d-a6680bee30f7/Dots-6a1cf9f9-032c-45ec-9b1d-a6680bee30f7-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "DoubleTaperedFlat" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_Shininess: { value: 0.1500 },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "DoubleTaperedFlat-0d3889f3-3ede-470c-8af4-f44813306126/DoubleTaperedFlat-0d3889f3-3ede-470c-8af4-f44813306126-v10.0-vertex.glsl",
	        fragmentShader: "DoubleTaperedFlat-0d3889f3-3ede-470c-8af4-f44813306126/DoubleTaperedFlat-0d3889f3-3ede-470c-8af4-f44813306126-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "DoubleTaperedMarker" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "DoubleTaperedMarker-0d3889f3-3ede-470c-8af4-de4813306126/DoubleTaperedMarker-0d3889f3-3ede-470c-8af4-de4813306126-v10.0-vertex.glsl",
	        fragmentShader: "DoubleTaperedMarker-0d3889f3-3ede-470c-8af4-de4813306126/DoubleTaperedMarker-0d3889f3-3ede-470c-8af4-de4813306126-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "DuctTape" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0.5372549, 0.5372549, 0.5372549) },
	            u_Shininess: { value: 0.414 },
	            u_MainTex: { value: "DuctTape-3ca16e2f-bdcd-4da2-8631-dcef342f40f1/DuctTape-3ca16e2f-bdcd-4da2-8631-dcef342f40f1-v10.0-MainTex.png" },
	            u_Cutoff: { value: 0.2 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "DuctTape-3ca16e2f-bdcd-4da2-8631-dcef342f40f1/DuctTape-3ca16e2f-bdcd-4da2-8631-dcef342f40f1-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0010, 0.0078, 1024, 128) },
	        },
	        vertexShader: "DuctTape-d0262945-853c-4481-9cbd-88586bed93cb/DuctTape-d0262945-853c-4481-9cbd-88586bed93cb-v10.0-vertex.glsl",
	        fragmentShader: "DuctTape-d0262945-853c-4481-9cbd-88586bed93cb/DuctTape-d0262945-853c-4481-9cbd-88586bed93cb-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Electricity" : {
	        uniforms: {
	            u_time: { value: new three.Vector4() },
	            u_DisplacementIntensity: { value: 2.0 },
	            u_EmissionGain: { value: 0.2 }
	        },
	        vertexShader: "Electricity-f6e85de3-6dcc-4e7f-87fd-cee8c3d25d51/Electricity-f6e85de3-6dcc-4e7f-87fd-cee8c3d25d51-v10.0-vertex.glsl",
	        fragmentShader: "Electricity-f6e85de3-6dcc-4e7f-87fd-cee8c3d25d51/Electricity-f6e85de3-6dcc-4e7f-87fd-cee8c3d25d51-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "Embers" : {
	        uniforms: {
	            u_time: { value: new three.Vector4() },
	            u_ScrollRate: { value: 0.6 },
	            u_ScrollDistance: { value: new three.Vector3(-0.2, 0.6, 0) },
	            u_ScrollJitterIntensity: { value: 0.03 },
	            u_ScrollJitterFrequency: { value: 5 },
	            u_TintColor: { value: new three.Vector4(1, 1, 1, 1) },
	            u_MainTex: { value: "Embers-02ffb866-7fb2-4d15-b761-1012cefb1360/Embers-02ffb866-7fb2-4d15-b761-1012cefb1360-v10.0-MainTex.png" },
	            u_Cutoff: { value: 0.2 }
	        },
	        vertexShader: "Embers-02ffb866-7fb2-4d15-b761-1012cefb1360/Embers-02ffb866-7fb2-4d15-b761-1012cefb1360-v10.0-vertex.glsl",
	        fragmentShader: "Embers-02ffb866-7fb2-4d15-b761-1012cefb1360/Embers-02ffb866-7fb2-4d15-b761-1012cefb1360-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "EnvironmentDiffuse" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_Shininess: { value: 0.1500 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_Cutoff: { value: 0.2 }
	        },
	        vertexShader: "EnvironmentDiffuse-0ad58bbd-42bc-484e-ad9a-b61036ff4ce7/EnvironmentDiffuse-0ad58bbd-42bc-484e-ad9a-b61036ff4ce7-v1.0-vertex.glsl",
	        fragmentShader: "EnvironmentDiffuse-0ad58bbd-42bc-484e-ad9a-b61036ff4ce7/EnvironmentDiffuse-0ad58bbd-42bc-484e-ad9a-b61036ff4ce7-v1.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "EnvironmentDiffuseLightMap" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_Shininess: { value: 0.1500 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_Cutoff: { value: 0.2 }
	        },
	        vertexShader: "EnvironmentDiffuseLightMap-d01d9d6c-9a61-4aba-8146-5891fafb013b/EnvironmentDiffuseLightMap-d01d9d6c-9a61-4aba-8146-5891fafb013b-v1.0-vertex.glsl",
	        fragmentShader: "EnvironmentDiffuseLightMap-d01d9d6c-9a61-4aba-8146-5891fafb013b/EnvironmentDiffuseLightMap-d01d9d6c-9a61-4aba-8146-5891fafb013b-v1.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Fire" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Fire-cb92b597-94ca-4255-b017-0e3f42f12f9e/Fire-cb92b597-94ca-4255-b017-0e3f42f12f9e-v10.0-MainTex.png" },
	            u_time: { value: new three.Vector4() },
	            u_EmissionGain: { value: 0.5 }
	        },
	        vertexShader: "Fire-cb92b597-94ca-4255-b017-0e3f42f12f9e/Fire-cb92b597-94ca-4255-b017-0e3f42f12f9e-v10.0-vertex.glsl",
	        fragmentShader: "Fire-cb92b597-94ca-4255-b017-0e3f42f12f9e/Fire-cb92b597-94ca-4255-b017-0e3f42f12f9e-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 2
	    },
	    "Flat" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_Cutoff: { value: 0.2 }
	        },
	        vertexShader: "Flat-2d35bcf0-e4d8-452c-97b1-3311be063130/Flat-2d35bcf0-e4d8-452c-97b1-3311be063130-v10.0-vertex.glsl",
	        fragmentShader: "Flat-2d35bcf0-e4d8-452c-97b1-3311be063130/Flat-2d35bcf0-e4d8-452c-97b1-3311be063130-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Highlighter" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Highlighter-cf019139-d41c-4eb0-a1d0-5cf54b0a42f3/Highlighter-cf019139-d41c-4eb0-a1d0-5cf54b0a42f3-v10.0-MainTex.png" },
	            u_Cutoff: { value: 0.12 }
	        },
	        vertexShader: "Highlighter-cf019139-d41c-4eb0-a1d0-5cf54b0a42f3/Highlighter-cf019139-d41c-4eb0-a1d0-5cf54b0a42f3-v10.0-vertex.glsl",
	        fragmentShader: "Highlighter-cf019139-d41c-4eb0-a1d0-5cf54b0a42f3/Highlighter-cf019139-d41c-4eb0-a1d0-5cf54b0a42f3-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "Hypercolor" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_Shininess: { value: 0.5 },
	            u_SpecColor: { value: new three.Vector3(0.2745098, 0.2745098, 0.2745098) },
	            u_MainTex: { value: "Hypercolor-dce872c2-7b49-4684-b59b-c45387949c5c/Hypercolor-dce872c2-7b49-4684-b59b-c45387949c5c-v10.0-MainTex.png" },
	            u_time: { value: new three.Vector4() },
	            u_Cutoff: { value: 0.5 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "Hypercolor-dce872c2-7b49-4684-b59b-c45387949c5c/Hypercolor-dce872c2-7b49-4684-b59b-c45387949c5c-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0010, 0.0078, 1024, 128) },
	        },
	        vertexShader: "Hypercolor-dce872c2-7b49-4684-b59b-c45387949c5c/Hypercolor-dce872c2-7b49-4684-b59b-c45387949c5c-v10.0-vertex.glsl",
	        fragmentShader: "Hypercolor-dce872c2-7b49-4684-b59b-c45387949c5c/Hypercolor-dce872c2-7b49-4684-b59b-c45387949c5c-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "HyperGrid" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_TintColor: { value: new three.Vector4(1, 1, 1, 1) },
	            u_MainTex: { value: "HyperGrid-6a1cf9f9-032c-45ec-9b6e-a6680bee32e9/HyperGrid-6a1cf9f9-032c-45ec-9b6e-a6680bee32e9-v10.0-MainTex.png" }
	        },
	        vertexShader: "HyperGrid-6a1cf9f9-032c-45ec-9b6e-a6680bee32e9/HyperGrid-6a1cf9f9-032c-45ec-9b6e-a6680bee32e9-v10.0-vertex.glsl",
	        fragmentShader: "HyperGrid-6a1cf9f9-032c-45ec-9b6e-a6680bee32e9/HyperGrid-6a1cf9f9-032c-45ec-9b6e-a6680bee32e9-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "Icing" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0.2352941, 0.2352941, 0.2352941) },
	            u_Shininess: { value: 0.1500 },
	            u_Cutoff: { value: 0.5 },
	            u_MainTex: { value: "Icing-2f212815-f4d3-c1a4-681a-feeaf9c6dc37/Icing-2f212815-f4d3-c1a4-681a-feeaf9c6dc37-v10.0-BumpMap.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "Icing-2f212815-f4d3-c1a4-681a-feeaf9c6dc37/Icing-2f212815-f4d3-c1a4-681a-feeaf9c6dc37-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0010, 0.0078, 1024, 128) },
	        },
	        vertexShader: "Icing-2f212815-f4d3-c1a4-681a-feeaf9c6dc37/Icing-2f212815-f4d3-c1a4-681a-feeaf9c6dc37-v10.0-vertex.glsl",
	        fragmentShader: "Icing-2f212815-f4d3-c1a4-681a-feeaf9c6dc37/Icing-2f212815-f4d3-c1a4-681a-feeaf9c6dc37-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Ink" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0.2352941, 0.2352941, 0.2352941) },
	            u_Shininess: { value: 0.4 },
	            u_Cutoff: { value: 0.5 },
	            u_MainTex: { value: "Ink-c0012095-3ffd-4040-8ee1-fc180d346eaa/Ink-c0012095-3ffd-4040-8ee1-fc180d346eaa-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "Ink-c0012095-3ffd-4040-8ee1-fc180d346eaa/Ink-c0012095-3ffd-4040-8ee1-fc180d346eaa-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0010, 0.0078, 1024, 128) },
	        },
	        vertexShader: "Ink-f5c336cf-5108-4b40-ade9-c687504385ab/Ink-f5c336cf-5108-4b40-ade9-c687504385ab-v10.0-vertex.glsl",
	        fragmentShader: "Ink-f5c336cf-5108-4b40-ade9-c687504385ab/Ink-f5c336cf-5108-4b40-ade9-c687504385ab-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Leaves" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_Shininess: { value: 0.395 },
	            u_Cutoff: { value: 0.5 },
	            u_MainTex: { value: "Leaves-ea19de07-d0c0-4484-9198-18489a3c1487/Leaves-ea19de07-d0c0-4484-9198-18489a3c1487-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "Leaves-ea19de07-d0c0-4484-9198-18489a3c1487/Leaves-ea19de07-d0c0-4484-9198-18489a3c1487-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0010, 0.0078, 1024, 128) },
	        },
	        vertexShader: "Leaves-ea19de07-d0c0-4484-9198-18489a3c1487/Leaves-ea19de07-d0c0-4484-9198-18489a3c1487-v10.0-vertex.glsl",
	        fragmentShader: "Leaves-ea19de07-d0c0-4484-9198-18489a3c1487/Leaves-ea19de07-d0c0-4484-9198-18489a3c1487-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Light" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Light-2241cd32-8ba2-48a5-9ee7-2caef7e9ed62/Light-2241cd32-8ba2-48a5-9ee7-2caef7e9ed62-v10.0-MainTex.png" },
	            u_EmissionGain: { value: 0.45 },
	        },
	        vertexShader: "Light-2241cd32-8ba2-48a5-9ee7-2caef7e9ed62/Light-2241cd32-8ba2-48a5-9ee7-2caef7e9ed62-v10.0-vertex.glsl",
	        fragmentShader: "Light-2241cd32-8ba2-48a5-9ee7-2caef7e9ed62/Light-2241cd32-8ba2-48a5-9ee7-2caef7e9ed62-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "LightWire" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_Shininess: { value: 0.81 },
	            u_SpecColor: { value: new three.Vector3(0.3455882, 0.3455882, 0.3455882) },
	            u_time: { value: new three.Vector4() },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "LightWire-4391aaaa-df81-4396-9e33-31e4e4930b27/LightWire-4391aaaa-df81-4396-9e33-31e4e4930b27-v10.0-vertex.glsl",
	        fragmentShader: "LightWire-4391aaaa-df81-4396-9e33-31e4e4930b27/LightWire-4391aaaa-df81-4396-9e33-31e4e4930b27-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Lofted" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "Lofted-d381e0f5-3def-4a0d-8853-31e9200bcbda/Lofted-d381e0f5-3def-4a0d-8853-31e9200bcbda-v10.0-vertex.glsl",
	        fragmentShader: "Lofted-d381e0f5-3def-4a0d-8853-31e9200bcbda/Lofted-d381e0f5-3def-4a0d-8853-31e9200bcbda-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Marker" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Marker-429ed64a-4e97-4466-84d3-145a861ef684/Marker-429ed64a-4e97-4466-84d3-145a861ef684-v10.0-MainTex.png" },
	            u_Cutoff: { value: 0.067 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "Marker-429ed64a-4e97-4466-84d3-145a861ef684/Marker-429ed64a-4e97-4466-84d3-145a861ef684-v10.0-vertex.glsl",
	        fragmentShader: "Marker-429ed64a-4e97-4466-84d3-145a861ef684/Marker-429ed64a-4e97-4466-84d3-145a861ef684-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0,

	    },
	    "MatteHull" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "MatteHull-79348357-432d-4746-8e29-0e25c112e3aa/MatteHull-79348357-432d-4746-8e29-0e25c112e3aa-v10.0-vertex.glsl",
	        fragmentShader: "MatteHull-79348357-432d-4746-8e29-0e25c112e3aa/MatteHull-79348357-432d-4746-8e29-0e25c112e3aa-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0,
	    },
	    "NeonPulse" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_time: { value: new three.Vector4() },
	            u_EmissionGain: { value: 0.5 },
	        },
	        vertexShader: "NeonPulse-b2ffef01-eaaa-4ab5-aa64-95a2c4f5dbc6/NeonPulse-b2ffef01-eaaa-4ab5-aa64-95a2c4f5dbc6-v10.0-vertex.glsl",
	        fragmentShader: "NeonPulse-b2ffef01-eaaa-4ab5-aa64-95a2c4f5dbc6/NeonPulse-b2ffef01-eaaa-4ab5-aa64-95a2c4f5dbc6-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "OilPaint": {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0.2352941, 0.2352941, 0.2352941) },
	            u_Shininess: { value: 0.4 },
	            u_Cutoff: { value: 0.5 },
	            u_MainTex: { value: "OilPaint-f72ec0e7-a844-4e38-82e3-140c44772699/OilPaint-f72ec0e7-a844-4e38-82e3-140c44772699-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "OilPaint-f72ec0e7-a844-4e38-82e3-140c44772699/OilPaint-f72ec0e7-a844-4e38-82e3-140c44772699-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0020, 0.0020, 512, 512) },
	        },
	        vertexShader: "OilPaint-f72ec0e7-a844-4e38-82e3-140c44772699/OilPaint-f72ec0e7-a844-4e38-82e3-140c44772699-v10.0-vertex.glsl",
	        fragmentShader: "OilPaint-f72ec0e7-a844-4e38-82e3-140c44772699/OilPaint-f72ec0e7-a844-4e38-82e3-140c44772699-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Paper" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_Shininess: { value: 0.145 },
	            u_Cutoff: { value: 0.16 },
	            u_MainTex: { value: "Paper-759f1ebd-20cd-4720-8d41-234e0da63716/Paper-759f1ebd-20cd-4720-8d41-234e0da63716-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "Paper-759f1ebd-20cd-4720-8d41-234e0da63716/Paper-759f1ebd-20cd-4720-8d41-234e0da63716-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0010, 0.0078, 1024, 128) },
	        },
	        vertexShader: "Paper-f1114e2e-eb8d-4fde-915a-6e653b54e9f5/Paper-f1114e2e-eb8d-4fde-915a-6e653b54e9f5-v10.0-vertex.glsl",
	        fragmentShader: "Paper-f1114e2e-eb8d-4fde-915a-6e653b54e9f5/Paper-f1114e2e-eb8d-4fde-915a-6e653b54e9f5-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "PbrTemplate" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_Shininess: { value: 0.1500 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_Cutoff: { value: 0.2 }
	        },
	        vertexShader: "PbrTemplate-f86a096c-2f4f-4f9d-ae19-81b99f2944e0/PbrTemplate-f86a096c-2f4f-4f9d-ae19-81b99f2944e0-v1.0-vertex.glsl",
	        fragmentShader: "PbrTemplate-f86a096c-2f4f-4f9d-ae19-81b99f2944e0/PbrTemplate-f86a096c-2f4f-4f9d-ae19-81b99f2944e0-v1.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "PbrTransparentTemplate" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_Shininess: { value: 0.1500 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_Cutoff: { value: 0.2 }
	        },
	        vertexShader: "PbrTransparentTemplate-19826f62-42ac-4a9e-8b77-4231fbd0cfbf/PbrTransparentTemplate-19826f62-42ac-4a9e-8b77-4231fbd0cfbf-v1.0-vertex.glsl",
	        fragmentShader: "PbrTransparentTemplate-19826f62-42ac-4a9e-8b77-4231fbd0cfbf/PbrTransparentTemplate-19826f62-42ac-4a9e-8b77-4231fbd0cfbf-v1.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Petal" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.8888, 0.8888, 0.8888, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_Shininess: { value: 0.01 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "Petal-e0abbc80-0f80-e854-4970-8924a0863dcc/Petal-e0abbc80-0f80-e854-4970-8924a0863dcc-v10.0-vertex.glsl",
	        fragmentShader: "Petal-e0abbc80-0f80-e854-4970-8924a0863dcc/Petal-e0abbc80-0f80-e854-4970-8924a0863dcc-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    // How did an experimental brush end up here?
	    "Plasma" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Plasma-c33714d1-b2f9-412e-bd50-1884c9d46336/Plasma-c33714d1-b2f9-412e-bd50-1884c9d46336-v10.0-MainTex.png" },
	            u_time: { value: new three.Vector4() }
	        },
	        vertexShader: "Plasma-c33714d1-b2f9-412e-bd50-1884c9d46336/Plasma-c33714d1-b2f9-412e-bd50-1884c9d46336-v10.0-vertex.glsl",
	        fragmentShader: "Plasma-c33714d1-b2f9-412e-bd50-1884c9d46336/Plasma-c33714d1-b2f9-412e-bd50-1884c9d46336-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Rainbow" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_time: { value: new three.Vector4() },
	            u_EmissionGain: { value: 0.65 }
	        },
	        vertexShader: "Rainbow-ad1ad437-76e2-450d-a23a-e17f8310b960/Rainbow-ad1ad437-76e2-450d-a23a-e17f8310b960-v10.0-vertex.glsl",
	        fragmentShader: "Rainbow-ad1ad437-76e2-450d-a23a-e17f8310b960/Rainbow-ad1ad437-76e2-450d-a23a-e17f8310b960-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "ShinyHull" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0.1985294, 0.1985294, 0.1985294) },
	            u_Shininess: { value: 0.7430 },
	            u_Cutoff: { value: 0.5 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "ShinyHull-faaa4d44-fcfb-4177-96be-753ac0421ba3/ShinyHull-faaa4d44-fcfb-4177-96be-753ac0421ba3-v10.0-vertex.glsl",
	        fragmentShader: "ShinyHull-faaa4d44-fcfb-4177-96be-753ac0421ba3/ShinyHull-faaa4d44-fcfb-4177-96be-753ac0421ba3-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Smoke": {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_TintColor: { value: new three.Vector4(1, 1, 1, 1) },
	            u_MainTex: { value: "Smoke-70d79cca-b159-4f35-990c-f02193947fe8/Smoke-70d79cca-b159-4f35-990c-f02193947fe8-v10.0-MainTex.png" }
	        },
	        vertexShader: "Smoke-70d79cca-b159-4f35-990c-f02193947fe8/Smoke-70d79cca-b159-4f35-990c-f02193947fe8-v10.0-vertex.glsl",
	        fragmentShader: "Smoke-70d79cca-b159-4f35-990c-f02193947fe8/Smoke-70d79cca-b159-4f35-990c-f02193947fe8-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 201,
	        blendSrc: 201,
	        alphaTest: 0.01,
	    },
	    "Snow" : {
	        uniforms: {
	            u_time: { value: new three.Vector4() },
	            u_ScrollRate: { value: 0.2 },
	            u_ScrollDistance: { value: new three.Vector3(0, -0.3, 0) },
	            u_ScrollJitterIntensity: { value: 0.01 },
	            u_ScrollJitterFrequency: { value: 12 },
	            u_TintColor: { value: new three.Vector4(1, 1, 1, 1) },
	            u_MainTex: { value: "Snow-d902ed8b-d0d1-476c-a8de-878a79e3a34c/Snow-d902ed8b-d0d1-476c-a8de-878a79e3a34c-v10.0-MainTex.png" },
	        },
	        vertexShader: "Snow-d902ed8b-d0d1-476c-a8de-878a79e3a34c/Snow-d902ed8b-d0d1-476c-a8de-878a79e3a34c-v10.0-vertex.glsl",
	        fragmentShader: "Snow-d902ed8b-d0d1-476c-a8de-878a79e3a34c/Snow-d902ed8b-d0d1-476c-a8de-878a79e3a34c-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "SoftHighlighter" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "SoftHighlighter-accb32f5-4509-454f-93f8-1df3fd31df1b/SoftHighlighter-accb32f5-4509-454f-93f8-1df3fd31df1b-v10.0-MainTex.png" },
	        },
	        vertexShader: "SoftHighlighter-accb32f5-4509-454f-93f8-1df3fd31df1b/SoftHighlighter-accb32f5-4509-454f-93f8-1df3fd31df1b-v10.0-vertex.glsl",
	        fragmentShader: "SoftHighlighter-accb32f5-4509-454f-93f8-1df3fd31df1b/SoftHighlighter-accb32f5-4509-454f-93f8-1df3fd31df1b-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "Spikes" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "Spikes-cf7f0059-7aeb-53a4-2b67-c83d863a9ffa/Spikes-cf7f0059-7aeb-53a4-2b67-c83d863a9ffa-v10.0-vertex.glsl",
	        fragmentShader: "Spikes-cf7f0059-7aeb-53a4-2b67-c83d863a9ffa/Spikes-cf7f0059-7aeb-53a4-2b67-c83d863a9ffa-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Splatter" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_MainTex: { value: "Splatter-7a1c8107-50c5-4b70-9a39-421576d6617e/Splatter-7a1c8107-50c5-4b70-9a39-421576d6617e-v10.0-MainTex.png" },
	            u_Cutoff: { value: 0.2 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "Splatter-7a1c8107-50c5-4b70-9a39-421576d6617e/Splatter-7a1c8107-50c5-4b70-9a39-421576d6617e-v10.0-vertex.glsl",
	        fragmentShader: "Splatter-7a1c8107-50c5-4b70-9a39-421576d6617e/Splatter-7a1c8107-50c5-4b70-9a39-421576d6617e-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Stars" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_time: { value: new three.Vector4() },
	            u_SparkleRate: { value: 5.3 },
	            u_MainTex: { value: "Stars-0eb4db27-3f82-408d-b5a1-19ebd7d5b711/Stars-0eb4db27-3f82-408d-b5a1-19ebd7d5b711-v10.0-MainTex.png" },
	        },
	        vertexShader: "Stars-0eb4db27-3f82-408d-b5a1-19ebd7d5b711/Stars-0eb4db27-3f82-408d-b5a1-19ebd7d5b711-v10.0-vertex.glsl",
	        fragmentShader: "Stars-0eb4db27-3f82-408d-b5a1-19ebd7d5b711/Stars-0eb4db27-3f82-408d-b5a1-19ebd7d5b711-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "Streamers" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Streamers-44bb800a-fbc3-4592-8426-94ecb05ddec3/Streamers-44bb800a-fbc3-4592-8426-94ecb05ddec3-v10.0-MainTex.png" },
	            u_EmissionGain: { value: 0.4 },
	            u_time: { value: new three.Vector4() },
	        },
	        vertexShader: "Streamers-44bb800a-fbc3-4592-8426-94ecb05ddec3/Streamers-44bb800a-fbc3-4592-8426-94ecb05ddec3-v10.0-vertex.glsl",
	        fragmentShader: "Streamers-44bb800a-fbc3-4592-8426-94ecb05ddec3/Streamers-44bb800a-fbc3-4592-8426-94ecb05ddec3-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 5,
	        blendDstAlpha: 201,
	        blendDst: 201,
	        blendEquationAlpha: 100,
	        blendEquation: 100,
	        blendSrcAlpha: 202,
	        blendSrc: 202,
	        alphaTest: 0.01,
	    },
	    "Taffy" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "Taffy-0077f88c-d93a-42f3-b59b-b31c50cdb414/Taffy-0077f88c-d93a-42f3-b59b-b31c50cdb414-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "Taffy-0077f88c-d93a-42f3-b59b-b31c50cdb414/Taffy-0077f88c-d93a-42f3-b59b-b31c50cdb414-v10.0-vertex.glsl",
	        fragmentShader: "Taffy-0077f88c-d93a-42f3-b59b-b31c50cdb414/Taffy-0077f88c-d93a-42f3-b59b-b31c50cdb414-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "TaperedFlat" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_MainTex: { value: "TaperedFlat-b468c1fb-f254-41ed-8ec9-57030bc5660c/TaperedFlat-b468c1fb-f254-41ed-8ec9-57030bc5660c-v10.0-MainTex.png" },
	            u_Cutoff: { value: 0.067 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "TaperedFlat-b468c1fb-f254-41ed-8ec9-57030bc5660c/TaperedFlat-b468c1fb-f254-41ed-8ec9-57030bc5660c-v10.0-vertex.glsl",
	        fragmentShader: "TaperedFlat-b468c1fb-f254-41ed-8ec9-57030bc5660c/TaperedFlat-b468c1fb-f254-41ed-8ec9-57030bc5660c-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "TaperedMarker" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "TaperedMarker-d90c6ad8-af0f-4b54-b422-e0f92abe1b3c/TaperedMarker-d90c6ad8-af0f-4b54-b422-e0f92abe1b3c-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "TaperedMarker-d90c6ad8-af0f-4b54-b422-e0f92abe1b3c/TaperedMarker-d90c6ad8-af0f-4b54-b422-e0f92abe1b3c-v10.0-vertex.glsl",
	        fragmentShader: "TaperedMarker-d90c6ad8-af0f-4b54-b422-e0f92abe1b3c/TaperedMarker-d90c6ad8-af0f-4b54-b422-e0f92abe1b3c-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "TaperedMarker_Flat" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0, 0, 0) },
	            u_Shininess: { value: 0.1500 },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_MainTex: { value: "TaperedMarker_Flat-1a26b8c0-8a07-4f8a-9fac-d2ef36e0cad0/TaperedMarker_Flat-1a26b8c0-8a07-4f8a-9fac-d2ef36e0cad0-v10.0-MainTex.png" },
	            u_Cutoff: { value: 0.2 }
	        },
	        vertexShader: "TaperedMarker_Flat-1a26b8c0-8a07-4f8a-9fac-d2ef36e0cad0/TaperedMarker_Flat-1a26b8c0-8a07-4f8a-9fac-d2ef36e0cad0-v10.0-vertex.glsl",
	        fragmentShader: "TaperedMarker_Flat-1a26b8c0-8a07-4f8a-9fac-d2ef36e0cad0/TaperedMarker_Flat-1a26b8c0-8a07-4f8a-9fac-d2ef36e0cad0-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "ThickPaint" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0.2352941, 0.2352941, 0.2352941) },
	            u_Shininess: { value: 0.4 },
	            u_Cutoff: { value: 0.5 },
	            u_MainTex: { value: "ThickPaint-75b32cf0-fdd6-4d89-a64b-e2a00b247b0f/ThickPaint-75b32cf0-fdd6-4d89-a64b-e2a00b247b0f-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "ThickPaint-75b32cf0-fdd6-4d89-a64b-e2a00b247b0f/ThickPaint-75b32cf0-fdd6-4d89-a64b-e2a00b247b0f-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0010, 0.0078, 1024, 128) },
	        },
	        vertexShader: "ThickPaint-75b32cf0-fdd6-4d89-a64b-e2a00b247b0f/ThickPaint-75b32cf0-fdd6-4d89-a64b-e2a00b247b0f-v10.0-vertex.glsl",
	        fragmentShader: "ThickPaint-75b32cf0-fdd6-4d89-a64b-e2a00b247b0f/ThickPaint-75b32cf0-fdd6-4d89-a64b-e2a00b247b0f-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "Toon" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "Toon-4391385a-df73-4396-9e33-31e4e4930b27/Toon-4391385a-df73-4396-9e33-31e4e4930b27-v10.0-vertex.glsl",
	        fragmentShader: "Toon-4391385a-df73-4396-9e33-31e4e4930b27/Toon-4391385a-df73-4396-9e33-31e4e4930b27-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0,
	    },
	    "UnlitHull" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "UnlitHull-a8fea537-da7c-4d4b-817f-24f074725d6d/UnlitHull-a8fea537-da7c-4d4b-817f-24f074725d6d-v10.0-vertex.glsl",
	        fragmentShader: "UnlitHull-a8fea537-da7c-4d4b-817f-24f074725d6d/UnlitHull-a8fea537-da7c-4d4b-817f-24f074725d6d-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0,
	    },
	    "VelvetInk" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_MainTex: { value: "VelvetInk-d229d335-c334-495a-a801-660ac8a87360/VelvetInk-d229d335-c334-495a-a801-660ac8a87360-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "VelvetInk-d229d335-c334-495a-a801-660ac8a87360/VelvetInk-d229d335-c334-495a-a801-660ac8a87360-v10.0-vertex.glsl",
	        fragmentShader: "VelvetInk-d229d335-c334-495a-a801-660ac8a87360/VelvetInk-d229d335-c334-495a-a801-660ac8a87360-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 2
	    },
	    "Waveform" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_EmissionGain: { value: 0.5178571 },
	            u_time: { value: new three.Vector4() },
	            u_MainTex: { value: "Waveform-10201aa3-ebc2-42d8-84b7-2e63f6eeb8ab/Waveform-10201aa3-ebc2-42d8-84b7-2e63f6eeb8ab-v10.0-MainTex.png" },
	        },
	        vertexShader: "Waveform-10201aa3-ebc2-42d8-84b7-2e63f6eeb8ab/Waveform-10201aa3-ebc2-42d8-84b7-2e63f6eeb8ab-v10.0-vertex.glsl",
	        fragmentShader: "Waveform-10201aa3-ebc2-42d8-84b7-2e63f6eeb8ab/Waveform-10201aa3-ebc2-42d8-84b7-2e63f6eeb8ab-v10.0-fragment.glsl",
	        side: 2,
	        transparent: true,
	        depthFunc: 2,
	        depthWrite: false,
	        depthTest: true,
	        blending: 2
	    },
	    "WetPaint" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_SpecColor: { value: new three.Vector3(0.1397059, 0.1397059, 0.1397059) },
	            u_Shininess: { value: 0.85 },
	            u_Cutoff: { value: 0.3 },
	            u_MainTex: { value: "WetPaint-b67c0e81-ce6d-40a8-aeb0-ef036b081aa3/WetPaint-b67c0e81-ce6d-40a8-aeb0-ef036b081aa3-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	            u_BumpMap: { value: "WetPaint-b67c0e81-ce6d-40a8-aeb0-ef036b081aa3/WetPaint-b67c0e81-ce6d-40a8-aeb0-ef036b081aa3-v10.0-BumpMap.png" },
	            u_BumpMap_TexelSize: { value: new three.Vector4(0.0010, 0.0078, 1024, 128) },
	        },
	        vertexShader: "WetPaint-b67c0e81-ce6d-40a8-aeb0-ef036b081aa3/WetPaint-b67c0e81-ce6d-40a8-aeb0-ef036b081aa3-v10.0-vertex.glsl",
	        fragmentShader: "WetPaint-b67c0e81-ce6d-40a8-aeb0-ef036b081aa3/WetPaint-b67c0e81-ce6d-40a8-aeb0-ef036b081aa3-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0
	    },
	    "WigglyGraphite" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_time: { value: new three.Vector4() },
	            u_ambient_light_color: { value: new three.Vector4(0.3922, 0.3922, 0.3922, 1) },
	            u_SceneLight_0_color: { value: new three.Vector4(0.7780, 0.8157, 0.9914, 1) },
	            u_SceneLight_1_color: { value: new three.Vector4(0.4282, 0.4212, 0.3459, 1) },
	            u_Cutoff: { value: 0.5 },
	            u_MainTex: { value: "WigglyGraphite-5347acf0-a8e2-47b6-8346-30c70719d763/WigglyGraphite-5347acf0-a8e2-47b6-8346-30c70719d763-v10.0-MainTex.png" },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 },
	        },
	        vertexShader: "WigglyGraphite-5347acf0-a8e2-47b6-8346-30c70719d763/WigglyGraphite-5347acf0-a8e2-47b6-8346-30c70719d763-v10.0-vertex.glsl",
	        fragmentShader: "WigglyGraphite-5347acf0-a8e2-47b6-8346-30c70719d763/WigglyGraphite-5347acf0-a8e2-47b6-8346-30c70719d763-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 2
	    },
	    "Wire" : {
	        uniforms: {
	            u_SceneLight_0_matrix: { value: [0.2931, 0.5524, -0.7803, 0, -0.8769, 0.4805, 0.0107, 0, 0.3809, 0.6811, 0.6253, 0, -4.9937, 8.1874, -46.2828, 1] },
	            u_SceneLight_1_matrix: { value: [0.1816, -0.1369, -0.9738, 0, -0.7915, -0.6080, -0.0621, 0, -0.5835, 0.7821, -0.2188, 0, -5.6205, 8.2530, -46.8315, 1] },
	            u_fogColor: { value: new three.Vector3(0.0196, 0.0196, 0.0196) },
	            u_fogDensity: { value: 0 }
	        },
	        vertexShader: "Wire-4391385a-cf83-4396-9e33-31e4e4930b27/Wire-4391385a-cf83-4396-9e33-31e4e4930b27-v10.0-vertex.glsl",
	        fragmentShader: "Wire-4391385a-cf83-4396-9e33-31e4e4930b27/Wire-4391385a-cf83-4396-9e33-31e4e4930b27-v10.0-fragment.glsl",
	        side: 2,
	        transparent: false,
	        depthFunc: 2,
	        depthWrite: true,
	        depthTest: true,
	        blending: 0,
	    },
	};

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation.

	Permission to use, copy, modify, and/or distribute this software for any
	purpose with or without fee is hereby granted.

	THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
	REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
	AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
	INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
	LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
	OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
	PERFORMANCE OF THIS SOFTWARE.
	***************************************************************************** */

	function __awaiter(thisArg, _arguments, P, generator) {
	    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
	    return new (P || (P = Promise))(function (resolve, reject) {
	        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
	        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
	        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
	        step((generator = generator.apply(thisArg, _arguments || [])).next());
	    });
	}

	class TiltLoader extends three.Loader {
	    constructor(manager) {
	        super(manager);
	        this.isGltfLegacy = false;
	        this.updateableMeshes = [];
	        this.rawTiltLoader = new TiltLoader$1.TiltLoader(manager);
	        this.gltfLoader = new GLTFLoader.GLTFLoader(manager);
	        this.legacygltf = new LegacyGLTFLoader(manager);
	        this.tiltShaderLoader = new TiltShaderLoader(manager);
	    }
	    setPath(path) {
	        this.rawTiltLoader.setPath(path);
	        this.gltfLoader.setPath(path);
	        this.legacygltf.setPath(path);
	        return this;
	    }
	    setBrushDirectory(path) {
	        this.tiltShaderLoader.setPath(path);
	        return this;
	    }
	    load(url, onLoad, onProgress, onError) {
	        return __awaiter(this, void 0, void 0, function* () {
	            this.loadedModel = (yield this.gltfLoader.loadAsync(url)).scene;
	            yield this.replaceBrushMaterials();
	            let data;
	            data = { scene: this.loadedModel, updateableMeshes: this.updateableMeshes };
	            onLoad(data);
	            return data;
	        });
	    }
	    loadTilt(url) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const tilt = yield this.rawTiltLoader.loadAsync(url);
	            this.loadedModel = tilt;
	        });
	    }
	    loadBrushGltf2(url) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const gltf = yield this.gltfLoader.loadAsync(url);
	            this.loadedModel = gltf.scene;
	            yield this.replaceBrushMaterials();
	        });
	    }
	    loadBrushGltf1(url) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const gltf = yield this.legacygltf.loadAsync(url);
	            this.loadedModel = gltf.scene;
	            this.isGltfLegacy = true;
	            yield this.replaceBrushMaterials();
	        });
	    }
	    replaceBrushMaterials() {
	        var _a, _b;
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this.loadedModel)
	                return;
	            let light0transform = new three.Matrix4().identity;
	            let light1transform = new three.Matrix4().identity;
	            light0transform = (_a = this.loadedModel.getObjectByName("node_SceneLight_0")) === null || _a === void 0 ? void 0 : _a.matrix;
	            light1transform = (_b = this.loadedModel.getObjectByName("node_SceneLight_1")) === null || _b === void 0 ? void 0 : _b.matrix;
	            if (!light0transform || !light1transform) {
	                this.loadedModel.traverse((object) => {
	                    if (object.name.startsWith("node_SceneLight_0")) {
	                        light0transform = object.modelViewMatrix;
	                    }
	                    else if (object.name.startsWith("node_SceneLight_1")) {
	                        light1transform = object.modelViewMatrix;
	                    }
	                });
	            }
	            this.loadedModel.traverse((object) => __awaiter(this, void 0, void 0, function* () {
	                if (object.type === "Mesh") {
	                    var targetFilter = "";
	                    var mesh = object;
	                    var material = mesh.material;
	                    var shader;
	                    if (!this.isGltfLegacy) {
	                        targetFilter = material.name;
	                    }
	                    else {
	                        targetFilter = "brush_" + mesh.name.split('_')[1];
	                    }
	                    switch (targetFilter) {
	                        case "brush_BlocksBasic":
	                            mesh.geometry.name = "geometry_BlocksBasic";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            shader = yield this.tiltShaderLoader.loadAsync("BlocksBasic");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_BlocksBasic";
	                            break;
	                        case "brush_BlocksGem":
	                            mesh.geometry.name = "geometry_BlocksGem";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            shader = yield this.tiltShaderLoader.loadAsync("BlocksGem");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_BlocksGem";
	                            break;
	                        case "brush_BlocksGlass":
	                            mesh.geometry.name = "geometry_BlocksGlass";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            shader = yield this.tiltShaderLoader.loadAsync("BlocksGlass");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_BlocksGlass";
	                            break;
	                        case "brush_Bubbles":
	                            mesh.geometry.name = "geometry_Bubbles";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute(this.isGltfLegacy ? "normal" : "_tb_unity_normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            mesh.geometry.setAttribute("a_texcoord1", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv2" : "_tb_unity_texcoord_1"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Bubbles");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Bubbles";
	                            break;
	                        case "brush_CelVinyl":
	                            mesh.geometry.name = "geometry_CelVinyl";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("CelVinyl");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_CelVinyl";
	                            break;
	                        case "brush_ChromaticWave":
	                            mesh.geometry.name = "geometry_ChromaticWave";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("ChromaticWave");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_ChromaticWave";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_CoarseBristles":
	                            mesh.geometry.name = "geometry_CoarseBristles";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("CoarseBristles");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_CoarseBristles";
	                            break;
	                        case "brush_Comet":
	                            mesh.geometry.name = "geometry_Comet";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Comet");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Comet";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_DiamondHull":
	                            mesh.geometry.name = "geometry_DiamondHull";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("DiamondHull");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_DiamondHull";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Disco":
	                            mesh.geometry.name = "geometry_Disco";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Disco");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Disco";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_DotMarker":
	                            mesh.geometry.name = "geometry_DotMarker";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("DotMarker");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_DotMarker";
	                            break;
	                        case "brush_Dots":
	                            mesh.geometry.name = "geometry_Dots";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute(this.isGltfLegacy ? "normal" : "_tb_unity_normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            mesh.geometry.setAttribute("a_texcoord1", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv2" : "_tb_unity_texcoord_1"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Dots");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Dots";
	                            break;
	                        case "brush_DoubleTaperedFlat":
	                            mesh.geometry.name = "geometry_DoubleTaperedFlat";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("DoubleTaperedFlat");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_DoubleTaperedFlat";
	                            break;
	                        case "brush_DoubleTaperedMarker":
	                            mesh.geometry.name = "geometry_DoubleTaperedMarker";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("DoubleTaperedMarker");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_DoubleTaperedMarker";
	                            break;
	                        case "brush_DuctTape":
	                            mesh.geometry.name = "geometry_DuctTape";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("DuctTape");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_DuctTape";
	                            break;
	                        case "brush_Electricity":
	                            mesh.geometry.name = "geometry_Electricity";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            mesh.geometry.setAttribute("a_texcoord1", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv2" : "_tb_unity_texcoord_1"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Electricity");
	                            mesh.material = shader;
	                            mesh.material.name = "material_Electricity";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Embers":
	                            mesh.geometry.name = "geometry_Embers";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute(this.isGltfLegacy ? "normal" : "_tb_unity_normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            mesh.geometry.setAttribute("a_texcoord1", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv2" : "_tb_unity_texcoord_1"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Embers");
	                            mesh.material = shader;
	                            mesh.material.name = "material_Embers";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_EnvironmentDiffuse":
	                            mesh.geometry.name = "geometry_EnvironmentDiffuse";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("EnvironmentDiffuse");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_EnvironmentDiffuse";
	                            break;
	                        case "brush_EnvironmentDiffuseLightMap":
	                            mesh.geometry.name = "geometry_EnvironmentDiffuseLightMap";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("EnvironmentDiffuseLightMap");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_EnvironmentDiffuseLightMap";
	                            break;
	                        case "brush_Fire":
	                            mesh.geometry.name = "geometry_Fire";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Fire");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Fire";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Flat":
	                            mesh.geometry.name = "geometry_Flat";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Flat");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Flat";
	                            break;
	                        case "brush_FlatDeprecated":
	                            mesh.geometry.name = "geometry_FlatDeprecated";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("FlatDeprecated");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_FlatDeprecated";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Highlighter":
	                            mesh.geometry.name = "geometry_Highlighter";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Highlighter");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Highlighter";
	                            break;
	                        case "brush_Hypercolor":
	                            mesh.geometry.name = "geometry_Hypercolor";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Hypercolor");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Hypercolor";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_HyperGrid":
	                            mesh.geometry.name = "geometry_HyperGrid";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            mesh.geometry.setAttribute("a_texcoord1", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv2" : "_tb_unity_texcoord_1"));
	                            shader = yield this.tiltShaderLoader.loadAsync("HyperGrid");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_HyperGrid";
	                            break;
	                        case "brush_Icing":
	                            mesh.geometry.name = "geometry_Icing";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Icing");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Icing";
	                            break;
	                        case "brush_Ink":
	                            mesh.geometry.name = "geometry_Ink";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Ink");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Ink";
	                            break;
	                        case "brush_Leaves":
	                            mesh.geometry.name = "geometry_Leaves";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Leaves");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Leaves";
	                            break;
	                        case "brush_Light":
	                            mesh.geometry.name = "geometry_Light";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Light");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Light";
	                            break;
	                        case "brush_LightWire":
	                            mesh.geometry.name = "geometry_LightWire";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("LightWire");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_LightWire";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Lofted":
	                            mesh.geometry.name = "geometry_Lofted";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Lofted");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Lofted";
	                            break;
	                        case "brush_Marker":
	                            mesh.geometry.name = "geometry_Marker";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Marker");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Marker";
	                            break;
	                        case "brush_MatteHull":
	                            mesh.geometry.name = "geometry_MatteHull";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            shader = yield this.tiltShaderLoader.loadAsync("MatteHull");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_MatteHull";
	                            break;
	                        case "brush_NeonPulse":
	                            mesh.geometry.name = "geometry_NeonPulse";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("NeonPulse");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_NeonPulse";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_OilPaint":
	                            mesh.geometry.name = "geometry_OilPaint";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("OilPaint");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_OilPaint";
	                            break;
	                        case "brush_Paper":
	                            mesh.geometry.name = "geometry_Paper";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Paper");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Paper";
	                            break;
	                        case "brush_PbrTemplate":
	                            mesh.geometry.name = "geometry_PbrTemplate";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("PbrTemplate");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_PbrTemplate";
	                            break;
	                        case "brush_PbrTransparentTemplate":
	                            mesh.geometry.name = "geometry_PbrTransparentTemplate";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("PbrTransparentTemplate");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_PbrTransparentTemplate";
	                            break;
	                        case "brush_Petal":
	                            mesh.geometry.name = "geometry_Petal";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Petal");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Petal";
	                            break;
	                        case "brush_Plasma":
	                            mesh.geometry.name = "geometry_Plasma";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Plasma");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Plasma";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Rainbow":
	                            mesh.geometry.name = "geometry_Rainbow";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Rainbow");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Rainbow";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_ShinyHull":
	                            mesh.geometry.name = "geometry_ShinyHull";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("ShinyHull");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_ShinyHull";
	                            break;
	                        case "brush_Smoke":
	                            mesh.geometry.name = "geometry_Smoke";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute(this.isGltfLegacy ? "normal" : "_tb_unity_normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            mesh.geometry.setAttribute("a_texcoord1", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv2" : "_tb_unity_texcoord_1"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Smoke");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Smoke";
	                            break;
	                        case "brush_Snow":
	                            mesh.geometry.name = "geometry_Snow";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute(this.isGltfLegacy ? "normal" : "_tb_unity_normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            mesh.geometry.setAttribute("a_texcoord1", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv2" : "_tb_unity_texcoord_1"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Snow");
	                            mesh.material = shader;
	                            mesh.material.name = "material_Snow";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_SoftHighlighter":
	                            mesh.geometry.name = "geometry_SoftHighlighter";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("SoftHighlighter");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_SoftHighlighter";
	                            break;
	                        case "brush_Spikes":
	                            mesh.geometry.name = "geometry_Spikes";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Spikes");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Spikes";
	                            break;
	                        case "brush_Splatter":
	                            mesh.geometry.name = "geometry_Splatter";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Splatter");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Splatter";
	                            break;
	                        case "brush_Stars":
	                            mesh.geometry.name = "geometry_Stars";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute(this.isGltfLegacy ? "normal" : "_tb_unity_normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            mesh.geometry.setAttribute("a_texcoord1", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv2" : "_tb_unity_texcoord_1"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Stars");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Stars";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Streamers":
	                            mesh.geometry.name = "geometry_Streamers";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Streamers");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Streamers";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Taffy":
	                            mesh.geometry.name = "geometry_Taffy";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("DiamondHull");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_DiamondHull";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_TaperedFlat":
	                            mesh.geometry.name = "geometry_TaperedFlat";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("TaperedFlat");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_TaperedFlat";
	                            break;
	                        case "brush_TaperedMarker":
	                            mesh.geometry.name = "geometry_TaperedMarker";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("TaperedMarker");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_TaperedMarker";
	                            break;
	                        case "brush_TaperedMarker_Flat":
	                            mesh.geometry.name = "geometry_Flat";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Flat");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Flat";
	                            break;
	                        case "brush_ThickPaint":
	                            mesh.geometry.name = "geometry_ThickPaint";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("ThickPaint");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_ThickPaint";
	                            break;
	                        case "brush_Toon":
	                            mesh.geometry.name = "geometry_Toon";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Toon");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Toon";
	                            break;
	                        case "brush_UnlitHull":
	                            mesh.geometry.name = "geometry_UnlitHull";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            shader = yield this.tiltShaderLoader.loadAsync("UnlitHull");
	                            mesh.material = shader;
	                            mesh.material.name = "material_UnlitHull";
	                            break;
	                        case "brush_VelvetInk":
	                            mesh.geometry.name = "geometry_VelvetInk";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("VelvetInk");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_VelvetInk";
	                            break;
	                        case "brush_Waveform":
	                            mesh.geometry.name = "geometry_Waveform";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Waveform");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_Waveform";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_WetPaint":
	                            mesh.geometry.name = "geometry_WetPaint";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("WetPaint");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_WetPaint";
	                            break;
	                        case "brush_WigglyGraphite":
	                            mesh.geometry.name = "geometry_WigglyGraphite";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            mesh.geometry.setAttribute("a_texcoord0", mesh.geometry.getAttribute(this.isGltfLegacy ? "uv" : "_tb_unity_texcoord_0"));
	                            shader = yield this.tiltShaderLoader.loadAsync("WigglyGraphite");
	                            shader.uniforms["u_SceneLight_0_matrix"].value = light0transform;
	                            shader.uniforms["u_SceneLight_1_matrix"].value = light1transform;
	                            shader.uniformsNeedUpdate = true;
	                            mesh.material = shader;
	                            mesh.material.name = "material_WigglyGraphite";
	                            this.updateableMeshes.push(mesh);
	                            break;
	                        case "brush_Wire":
	                            mesh.geometry.name = "geometry_Wire";
	                            mesh.geometry.setAttribute("a_position", mesh.geometry.getAttribute("position"));
	                            mesh.geometry.setAttribute("a_normal", mesh.geometry.getAttribute("normal"));
	                            mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
	                            shader = yield this.tiltShaderLoader.loadAsync("Wire");
	                            mesh.material = shader;
	                            mesh.material.name = "material_Wire";
	                            break;
	                    }
	                }
	            }));
	        });
	    }
	}

	exports.LegacyGLTFLoader = LegacyGLTFLoader;
	exports.TiltLoader = TiltLoader;
	exports.TiltShaderLoader = TiltShaderLoader;
	exports.updateBrushes = updateBrushes;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
