
var Module;

if (typeof Module === 'undefined') Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
  Module.finishedDataFileDownloads = 0;
}
Module.expectedDataFileDownloads++;
(function() {
 var loadPackage = function(metadata) {

  var PACKAGE_PATH;
  if (typeof window === 'object') {
    PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.toString().substring(0, window.location.pathname.toString().lastIndexOf('/')) + '/');
  } else if (typeof location !== 'undefined') {
      // worker
      PACKAGE_PATH = encodeURIComponent(location.pathname.toString().substring(0, location.pathname.toString().lastIndexOf('/')) + '/');
    } else {
      throw 'using preloaded data can only be done on a web page or in a web worker';
    }
    var PACKAGE_NAME = 'game.data';
    var REMOTE_PACKAGE_BASE = 'game.data';
    if (typeof Module['locateFilePackage'] === 'function' && !Module['locateFile']) {
      Module['locateFile'] = Module['locateFilePackage'];
      Module.printErr('warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)');
    }
    var REMOTE_PACKAGE_NAME = typeof Module['locateFile'] === 'function' ?
    Module['locateFile'](REMOTE_PACKAGE_BASE) :
    ((Module['filePackagePrefixURL'] || '') + REMOTE_PACKAGE_BASE);

    var REMOTE_PACKAGE_SIZE = metadata.remote_package_size;
    var PACKAGE_UUID = metadata.package_uuid;

    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', packageName, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = function(event) {
        var url = packageName;
        var size = packageSize;
        if (event.total) size = event.total;
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true;
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size
            };
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded;
          }
          var total = 0;
          var loaded = 0;
          var num = 0;
          for (var download in Module.dataFileDownloads) {
            var data = Module.dataFileDownloads[download];
            total += data.total;
            loaded += data.loaded;
            num++;
          }
          total = Math.ceil(total * Module.expectedDataFileDownloads/num);
          if (Module['setStatus']) Module['setStatus']('Downloading data... (' + loaded + '/' + total + ')');
        } else if (!Module.dataFileDownloads) {
          if (Module['setStatus']) Module['setStatus']('Downloading data...');
        }
      };
      xhr.onerror = function(event) {
        throw new Error("NetworkError for: " + packageName);
      }
      xhr.onload = function(event) {
        if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
          var packageData = xhr.response;
          callback(packageData);
        } else {
          throw new Error(xhr.statusText + " : " + xhr.responseURL);
        }
      };
      xhr.send(null);
    };

    function handleError(error) {
      console.error('package error:', error);
    };

    function runWithFS() {

      function assert(check, msg) {
        if (!check) throw msg + new Error().stack;
      }
      Module['FS_createPath']('/', 'assets', true, true);
      Module['FS_createPath']('/assets', 'models', true, true);
      Module['FS_createPath']('/', 'libs', true, true);
      Module['FS_createPath']('/', 'menori', true, true);
      Module['FS_createPath']('/menori', 'docs', true, true);
      Module['FS_createPath']('/menori', 'modules', true, true);
      Module['FS_createPath']('/menori/modules', 'core3d', true, true);
      Module['FS_createPath']('/menori/modules/core3d', 'shapes', true, true);
      Module['FS_createPath']('/menori/modules', 'deprecated', true, true);
      Module['FS_createPath']('/menori/modules', 'libs', true, true);
      Module['FS_createPath']('/menori/modules', 'ml', true, true);
      Module['FS_createPath']('/menori/modules/ml', 'modules', true, true);
      Module['FS_createPath']('/menori/modules', 'shaders', true, true);
      Module['FS_createPath']('/menori/modules/shaders', 'chunks', true, true);
      Module['FS_createPath']('/menori/modules/shaders', 'love12', true, true);
      Module['FS_createPath']('/', 'scenes', true, true);
      Module['FS_createPath']('/scenes', 'tch_test', true, true);

      function DataRequest(start, end, crunched, audio) {
        this.start = start;
        this.end = end;
        this.crunched = crunched;
        this.audio = audio;
      }
      DataRequest.prototype = {
        requests: {},
        open: function(mode, name) {
          this.name = name;
          this.requests[name] = this;
          Module['addRunDependency']('fp ' + this.name);
        },
        send: function() {},
        onload: function() {
          var byteArray = this.byteArray.subarray(this.start, this.end);

          this.finish(byteArray);

        },
        finish: function(byteArray) {
          var that = this;

        Module['FS_createDataFile'](this.name, null, byteArray, true, true, true); // canOwn this data in the filesystem, it is a slide into the heap that will never change
        Module['removeRunDependency']('fp ' + that.name);

        this.requests[this.name] = null;
      }
    };

    var files = metadata.files;
    for (i = 0; i < files.length; ++i) {
      new DataRequest(files[i].start, files[i].end, files[i].crunched, files[i].audio).open('GET', files[i].filename);
    }


    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    var IDB_RO = "readonly";
    var IDB_RW = "readwrite";
    var DB_NAME = "EM_PRELOAD_CACHE";
    var DB_VERSION = 1;
    var METADATA_STORE_NAME = 'METADATA';
    var PACKAGE_STORE_NAME = 'PACKAGES';
    function openDatabase(callback, errback) {
      try {
        var openRequest = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        return errback(e);
      }
      openRequest.onupgradeneeded = function(event) {
        var db = event.target.result;

        if(db.objectStoreNames.contains(PACKAGE_STORE_NAME)) {
          db.deleteObjectStore(PACKAGE_STORE_NAME);
        }
        var packages = db.createObjectStore(PACKAGE_STORE_NAME);

        if(db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          db.deleteObjectStore(METADATA_STORE_NAME);
        }
        var metadata = db.createObjectStore(METADATA_STORE_NAME);
      };
      openRequest.onsuccess = function(event) {
        var db = event.target.result;
        callback(db);
      };
      openRequest.onerror = function(error) {
        errback(error);
      };
    };

    /* Check if there's a cached package, and if so whether it's the latest available */
    function checkCachedPackage(db, packageName, callback, errback) {
      var transaction = db.transaction([METADATA_STORE_NAME], IDB_RO);
      var metadata = transaction.objectStore(METADATA_STORE_NAME);

      var getRequest = metadata.get("metadata/" + packageName);
      getRequest.onsuccess = function(event) {
        var result = event.target.result;
        if (!result) {
          return callback(false);
        } else {
          return callback(PACKAGE_UUID === result.uuid);
        }
      };
      getRequest.onerror = function(error) {
        errback(error);
      };
    };

    function fetchCachedPackage(db, packageName, callback, errback) {
      var transaction = db.transaction([PACKAGE_STORE_NAME], IDB_RO);
      var packages = transaction.objectStore(PACKAGE_STORE_NAME);

      var getRequest = packages.get("package/" + packageName);
      getRequest.onsuccess = function(event) {
        var result = event.target.result;
        callback(result);
      };
      getRequest.onerror = function(error) {
        errback(error);
      };
    };

    function cacheRemotePackage(db, packageName, packageData, packageMeta, callback, errback) {
      var transaction_packages = db.transaction([PACKAGE_STORE_NAME], IDB_RW);
      var packages = transaction_packages.objectStore(PACKAGE_STORE_NAME);

      var putPackageRequest = packages.put(packageData, "package/" + packageName);
      putPackageRequest.onsuccess = function(event) {
        var transaction_metadata = db.transaction([METADATA_STORE_NAME], IDB_RW);
        var metadata = transaction_metadata.objectStore(METADATA_STORE_NAME);
        var putMetadataRequest = metadata.put(packageMeta, "metadata/" + packageName);
        putMetadataRequest.onsuccess = function(event) {
          callback(packageData);
        };
        putMetadataRequest.onerror = function(error) {
          errback(error);
        };
      };
      putPackageRequest.onerror = function(error) {
        errback(error);
      };
    };

    function processPackageData(arrayBuffer) {
      Module.finishedDataFileDownloads++;
      assert(arrayBuffer, 'Loading data file failed.');
      assert(arrayBuffer instanceof ArrayBuffer, 'bad input to processPackageData');
      var byteArray = new Uint8Array(arrayBuffer);
      var curr;

        // copy the entire loaded file into a spot in the heap. Files will refer to slices in that. They cannot be freed though
        // (we may be allocating before malloc is ready, during startup).
        if (Module['SPLIT_MEMORY']) Module.printErr('warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting');
        var ptr = Module['getMemory'](byteArray.length);
        Module['HEAPU8'].set(byteArray, ptr);
        DataRequest.prototype.byteArray = Module['HEAPU8'].subarray(ptr, ptr+byteArray.length);

        var files = metadata.files;
        for (i = 0; i < files.length; ++i) {
          DataRequest.prototype.requests[files[i].filename].onload();
        }
        Module['removeRunDependency']('datafile_game.data');

      };
      Module['addRunDependency']('datafile_game.data');

      if (!Module.preloadResults) Module.preloadResults = {};

      function preloadFallback(error) {
        console.error(error);
        console.error('falling back to default preload behavior');
        fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, processPackageData, handleError);
      };

      openDatabase(
        function(db) {
          checkCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME,
            function(useCached) {
              Module.preloadResults[PACKAGE_NAME] = {fromCache: useCached};
              if (useCached) {
                console.info('loading ' + PACKAGE_NAME + ' from cache');
                fetchCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME, processPackageData, preloadFallback);
              } else {
                console.info('loading ' + PACKAGE_NAME + ' from remote');
                fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE,
                  function(packageData) {
                    cacheRemotePackage(db, PACKAGE_PATH + PACKAGE_NAME, packageData, {uuid:PACKAGE_UUID}, processPackageData,
                      function(error) {
                        console.error(error);
                        processPackageData(packageData);
                      });
                  }
                  , preloadFallback);
              }
            }
            , preloadFallback);
        }
        , preloadFallback);

      if (Module['setStatus']) Module['setStatus']('Downloading...');

    }
    if (Module['calledRun']) {
      runWithFS();
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
    }

  }
  loadPackage({"package_uuid":"5f157725-f639-4670-916f-8f15763351dd","remote_package_size":4940344,"files":[{"filename":"/.DS_Store","crunched":0,"start":0,"end":8196,"audio":false},{"filename":"/assets/.DS_Store","crunched":0,"start":8196,"end":14344,"audio":false},{"filename":"/assets/models/etrian_odyssey_3_monk.glb","crunched":0,"start":14344,"end":3993768,"audio":false},{"filename":"/assets/models/etrian_odyssey_3_monk_license.txt","crunched":0,"start":3993768,"end":3994476,"audio":false},{"filename":"/assets/models/tancho_model.glb","crunched":0,"start":3994476,"end":4673548,"audio":false},{"filename":"/conf.lua","crunched":0,"start":4673548,"end":4673843,"audio":false},{"filename":"/libs/json.lua","crunched":0,"start":4673843,"end":4683481,"audio":false},{"filename":"/main.lua","crunched":0,"start":4683481,"end":4686451,"audio":false},{"filename":"/menori/.DS_Store","crunched":0,"start":4686451,"end":4692599,"audio":false},{"filename":"/menori/docs/config.ld","crunched":0,"start":4692599,"end":4692807,"audio":false},{"filename":"/menori/init.lua","crunched":0,"start":4692807,"end":4695122,"audio":false},{"filename":"/menori/modules/camera.lua","crunched":0,"start":4695122,"end":4698759,"audio":false},{"filename":"/menori/modules/core3d/camera.lua","crunched":0,"start":4698759,"end":4703248,"audio":false},{"filename":"/menori/modules/core3d/environment.lua","crunched":0,"start":4703248,"end":4707626,"audio":false},{"filename":"/menori/modules/core3d/gltf.lua","crunched":0,"start":4707626,"end":4727690,"audio":false},{"filename":"/menori/modules/core3d/gltf_animations.lua","crunched":0,"start":4727690,"end":4731078,"audio":false},{"filename":"/menori/modules/core3d/instanced_mesh.lua","crunched":0,"start":4731078,"end":4734408,"audio":false},{"filename":"/menori/modules/core3d/material.lua","crunched":0,"start":4734408,"end":4738872,"audio":false},{"filename":"/menori/modules/core3d/mesh.lua","crunched":0,"start":4738872,"end":4751969,"audio":false},{"filename":"/menori/modules/core3d/model_node.lua","crunched":0,"start":4751969,"end":4757961,"audio":false},{"filename":"/menori/modules/core3d/node_tree_builder.lua","crunched":0,"start":4757961,"end":4763509,"audio":false},{"filename":"/menori/modules/core3d/shapes/box.lua","crunched":0,"start":4763509,"end":4767268,"audio":false},{"filename":"/menori/modules/core3d/shapes/capsule.lua","crunched":0,"start":4767268,"end":4770969,"audio":false},{"filename":"/menori/modules/core3d/shapes/plane.lua","crunched":0,"start":4770969,"end":4773259,"audio":false},{"filename":"/menori/modules/core3d/shapes/sphere.lua","crunched":0,"start":4773259,"end":4775557,"audio":false},{"filename":"/menori/modules/core3d/shapes/triangle.lua","crunched":0,"start":4775557,"end":4777925,"audio":false},{"filename":"/menori/modules/core3d/shapes/vertexformat.lua","crunched":0,"start":4777925,"end":4778635,"audio":false},{"filename":"/menori/modules/core3d/uniform_list.lua","crunched":0,"start":4778635,"end":4781818,"audio":false},{"filename":"/menori/modules/deprecated/app.lua","crunched":0,"start":4781818,"end":4784458,"audio":false},{"filename":"/menori/modules/deprecated/geometry_buffer.lua","crunched":0,"start":4784458,"end":4786662,"audio":false},{"filename":"/menori/modules/libs/class.lua","crunched":0,"start":4786662,"end":4788125,"audio":false},{"filename":"/menori/modules/libs/ffi.lua","crunched":0,"start":4788125,"end":4788215,"audio":false},{"filename":"/menori/modules/libs/utils.lua","crunched":0,"start":4788215,"end":4790273,"audio":false},{"filename":"/menori/modules/ml/init.lua","crunched":0,"start":4790273,"end":4790550,"audio":false},{"filename":"/menori/modules/ml/modules/bound3.lua","crunched":0,"start":4790550,"end":4792531,"audio":false},{"filename":"/menori/modules/ml/modules/bvh.lua","crunched":0,"start":4792531,"end":4803995,"audio":false},{"filename":"/menori/modules/ml/modules/intersect.lua","crunched":0,"start":4803995,"end":4832798,"audio":false},{"filename":"/menori/modules/ml/modules/mat4.lua","crunched":0,"start":4832798,"end":4853203,"audio":false},{"filename":"/menori/modules/ml/modules/quat.lua","crunched":0,"start":4853203,"end":4864286,"audio":false},{"filename":"/menori/modules/ml/modules/utils.lua","crunched":0,"start":4864286,"end":4865262,"audio":false},{"filename":"/menori/modules/ml/modules/vec2.lua","crunched":0,"start":4865262,"end":4870219,"audio":false},{"filename":"/menori/modules/ml/modules/vec3.lua","crunched":0,"start":4870219,"end":4876319,"audio":false},{"filename":"/menori/modules/ml/modules/vec4.lua","crunched":0,"start":4876319,"end":4882270,"audio":false},{"filename":"/menori/modules/node.lua","crunched":0,"start":4882270,"end":4893305,"audio":false},{"filename":"/menori/modules/scene.lua","crunched":0,"start":4893305,"end":4897858,"audio":false},{"filename":"/menori/modules/scenemanager.lua","crunched":0,"start":4897858,"end":4900904,"audio":false},{"filename":"/menori/modules/shaders/chunks/billboard.glsl","crunched":0,"start":4900904,"end":4900977,"audio":false},{"filename":"/menori/modules/shaders/chunks/billboard_base.glsl","crunched":0,"start":4900977,"end":4901031,"audio":false},{"filename":"/menori/modules/shaders/chunks/color.glsl","crunched":0,"start":4901031,"end":4901116,"audio":false},{"filename":"/menori/modules/shaders/chunks/inverse.glsl","crunched":0,"start":4901116,"end":4903170,"audio":false},{"filename":"/menori/modules/shaders/chunks/morph_base.glsl","crunched":0,"start":4903170,"end":4903225,"audio":false},{"filename":"/menori/modules/shaders/chunks/normal.glsl","crunched":0,"start":4903225,"end":4903515,"audio":false},{"filename":"/menori/modules/shaders/chunks/normal_base.glsl","crunched":0,"start":4903515,"end":4903608,"audio":false},{"filename":"/menori/modules/shaders/chunks/skinning_normal.glsl","crunched":0,"start":4903608,"end":4903731,"audio":false},{"filename":"/menori/modules/shaders/chunks/skinning_vertex.glsl","crunched":0,"start":4903731,"end":4904114,"audio":false},{"filename":"/menori/modules/shaders/chunks/skinning_vertex_base.glsl","crunched":0,"start":4904114,"end":4904632,"audio":false},{"filename":"/menori/modules/shaders/chunks/texcoord.glsl","crunched":0,"start":4904632,"end":4904738,"audio":false},{"filename":"/menori/modules/shaders/chunks/transpose.glsl","crunched":0,"start":4904738,"end":4905190,"audio":false},{"filename":"/menori/modules/shaders/default_mesh_frag.glsl","crunched":0,"start":4905190,"end":4905773,"audio":false},{"filename":"/menori/modules/shaders/default_mesh_vert.glsl","crunched":0,"start":4905773,"end":4906447,"audio":false},{"filename":"/menori/modules/shaders/deferred_mesh_frag.glsl","crunched":0,"start":4906447,"end":4907150,"audio":false},{"filename":"/menori/modules/shaders/instanced_mesh_vert.glsl","crunched":0,"start":4907150,"end":4907836,"audio":false},{"filename":"/menori/modules/shaders/love12/default_mesh_frag.glsl","crunched":0,"start":4907836,"end":4908411,"audio":false},{"filename":"/menori/modules/shaders/love12/default_mesh_vert.glsl","crunched":0,"start":4908411,"end":4909157,"audio":false},{"filename":"/menori/modules/shaders/love12/deferred_mesh_frag.glsl","crunched":0,"start":4909157,"end":4909860,"audio":false},{"filename":"/menori/modules/shaders/love12/instanced_mesh_vert.glsl","crunched":0,"start":4909860,"end":4910573,"audio":false},{"filename":"/menori/modules/shaders/outline_mesh_frag.glsl","crunched":0,"start":4910573,"end":4911298,"audio":false},{"filename":"/menori/modules/shaders/outline_mesh_vert.glsl","crunched":0,"start":4911298,"end":4911988,"audio":false},{"filename":"/menori/modules/shaders/utils.lua","crunched":0,"start":4911988,"end":4918240,"audio":false},{"filename":"/menori/modules/sprite.lua","crunched":0,"start":4918240,"end":4923021,"audio":false},{"filename":"/menori/modules/spriteloader.lua","crunched":0,"start":4923021,"end":4926768,"audio":false},{"filename":"/scenes/.DS_Store","crunched":0,"start":4926768,"end":4932916,"audio":false},{"filename":"/scenes/tch_test/scene.lua","crunched":0,"start":4932916,"end":4940344,"audio":false}]});

})();
