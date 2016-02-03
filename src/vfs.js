/**************************************************************************************************************************************************
 *
 *
 *
 *                             Virtual File System for Modern Web Browsers
 *                             Created by: .modernator
 *               
 *                             Virtual File System is free to use, please comment in your web apps that I made this.
 *                             You can use this for commercial product.
 *                             If you found the errors or have good idea, please text me: rico345100@gmail.com
 *
 *                             Visit my blog to find more stuffs!
 *                             http://modernator.me
 *
 *
 *
 *************************************************************************************************************************************************/

Object.prototype.serialize = function () {
    return JSON.stringify(this);
};
Object.prototype.size = function () {
    var cnt = 0, key;

    for (key in this) {
        if (key === 'size' || key === 'serialize') continue;
        if (this.hasOwnProperty(key)) cnt++;
    }

    return cnt;
}

//FileObject({ uniqueId: as int, directoryId: as int, name: as string, type: as string, created_at: as Date, updated_at: as Date, executed_at: as Date, content: as string, readOnly: as boolean }) : Create a FileObject.
function FileObject(option) {
    option = typeof option !== 'undefined' ? option : {};
    this.uniqueId = typeof option.uniqueId !== 'undefined' ? option.uniqueId : 0;
    this.directoryId = typeof option.directoryId !== 'undefined' ? option.directoryId : 0;
    this.name = typeof option.name !== 'undefined' ? option.name : '';
    this.type = typeof option.type !== 'undefined' ? option.type : 'plain/text';
    this.created_at = typeof option.created_at !== 'undefined' ? option.created_at : new Date();
    this.updated_at = typeof option.updated_at !== 'undefined' ? option.updated_at : new Date();
    this.executed_at = typeof option.executed_at !== 'undefined' ? option.executed_at : new Date();
    this.content = typeof option.content !== 'undefined' ? option.content : '';
    this.readOnly = typeof option.readOnly !== 'undefined' ? option.readOnly : false;
}

//FileSystemConstructor({ key: as string, readOnly: as boolean }) : Create a FileSystem
function FileSystem(option) {
    var self = this;

    option = typeof option !== 'undefined' ? option : {};

    var version = 1;
    var engine = 'vjfs1';
    var storageKey = typeof option.key !== 'undefined' ? Crypto.hash(option.key) : false;
    var readOnly = typeof option.readOnly !== 'undefined' ? option.readOnly : false;      //If it sets, you can't use create/update/remove API.

    if (!storageKey) {
        console.error('FileSystem API: Failed to create FileSystem object. No key.');
        return false;
    };

    var fileCounter = 0;
    var filePointers = {};

    this.getVersion = function () {
        return version;
    };
    this.getEngine = function () {
        return engine;
    };
    this.getKey = function () {
        return storageKey;
    };

    var Storage = {
        getData: function (key) {
            return localStorage[storageKey + "_" + key];
        },
        setData: function (key, value) {
            localStorage[storageKey + "_" + key] = value;
        },
        removeData: function (key) {
            localStorage.removeItem(storageKey + "_" + key);
        }
    };


    /******************************************************************************************************************
     *
     *
     *
     *                                                         Private API's
     *
     *
     *
     ******************************************************************************************************************/

    //generateFileId() : Generate file id and increase it.
    function generateFileId() {
        Storage.setData("file-counter", fileCounter + 1);
        return fileCounter++;
    };
    function createFile(option) {
        option = typeof option === 'object' ? option : {};
        var content = typeof option.content !== 'undefined' ? option.content : '';
        delete option.content;

        var tempFile = new FileObject(option);
        delete tempFile.content;

        //Write file to storage
        Storage.setData('file-' + option.uniqueId, tempFile.serialize());

        //Is Directory? If that, create new Pointer.
        if (option.type === 'directory') FilePointer.create(option.uniqueId);
        //Else, create content
        else Storage.setData('file-content-' + option.uniqueId, content);

        //Create File Pointer
        if (FilePointer.set(option.uniqueId, option.directoryId)) FilePointer.save();

        return tempFile;
    };
    function updateFile(option) {
        option = typeof option === 'object' ? option : {};

        var fileId = option.uniqueId;
        var tempFile = Storage.getData('file-' + fileId);   //Get serialized file data
        var tempFileContent = Storage.getData('file-content-' + fileId);    //Get content

        //No file
        if (!tempFile) {
            console.error('FileSystem API: Failed to update file. File does not exists.');
            return false;
        }

        //Create file object
        tempFile = JSON.parse(tempFile);

        //Read only?
        var readOnly = tempFile.readOnly;
        if(readOnly && typeof option.content !== 'undefined' && option.content !== tempFileContent ) {
            console.error('FileSystem API: File is read only.');
            return false;
        }

        //Attach content
        tempFile.content = Storage.getData('file-content-' + fileId);

        var failed = false;
        for (var property in tempFile) {
            if (property === 'uniqueId' || property === 'size' || property === 'serialize') continue;
            if (tempFile.type === 'directory' && property === 'content') continue;

            if (typeof option[property] !== 'undefined') {
                //If directory changed, need to update FilePointer
                if (property === 'directoryId' && tempFile.directoryId !== option.directoryId) {
                    var prevDir = tempFile.directoryId;
                    var newDir = option.directoryId;

                    //Remove from old
                    if (!FilePointer.unset(prevDir, option.uniqueId)) {
                        failed = true;
                        break;
                    }
                    if (!FilePointer.set(option.uniqueId, newDir)) {
                        failed = true;
                        break;
                    }
                }

                tempFile[property] = option[property];
            }
        }

        if (failed) {
            FilePointer.restore();  //Restore original pointers
            return false;
        }

        //Time to update!
        FilePointer.save();
        if(tempFile.type !== 'directory') Storage.setData('file-content-' + fileId, tempFile['content']);
        delete tempFile['content'];

        tempFile['updated_at'] = new Date().toGMTString();
        Storage.setData('file-' + fileId, tempFile.serialize());

        return true;
    };
    function removeFile(option) {
        option = typeof option === 'object' ? option : {};

        var fileId = option.uniqueId;
        var tempFile = Storage.getData('file-' + fileId);   //Get serialized file data
        var tempFileContent = Storage.getData('file-content-' + fileId);    //Get content

        //No file
        if (!tempFile) {
            console.error('FileSystem API: Failed to remove file. File does not exists.');
            return false;
        }

        //Create file object
        tempFile = JSON.parse(tempFile);

        //Check is directory. If do, need to delete all sub files.
        var isDirectory = tempFile.type === 'directory';

        var searchList = [fileId];  //List to search
        var removeList = [fileId];  //List to remove

        if (isDirectory) {
            var pointers = FilePointer.get();   //List of all File pointers. Use for determine the sub file in directory is directory.
            var searchId = 0;

            //Time to search!
            while (searchId = searchList.shift()) {
                var filesInDirectory = FilePointer.get(searchId);

                for (var i = 0, len = filesInDirectory.length; i < len; i++) {
                    removeList.push(filesInDirectory[i]);

                    for (var key in pointers) {
                        if (key === 'size') continue;
                        if (key === 'serialize') continue;

                        //Is directory!
                        if (key === filesInDirectory[i].toString()) {
                            searchList.push(filesInDirectory[i]);   //Add list to search
                            break;
                        }
                    }
                }
            }
        }

        //Time to remove!
        for (var i = 0, len = removeList.length; i < len; i++) {
            var fileToRemove = removeList[i];

            //Delete pointer
            FilePointer.delete(fileToRemove);

            //Actual file delete
            Storage.removeData('file-' + fileToRemove);
            Storage.removeData('file-content-' + fileToRemove);
        }

        FilePointer.unset(tempFile.directoryId, option.uniqueId, false);
        FilePointer.save();

        return true;
    };
    function install() {
        Storage.setData("installed", new Date().toGMTString());
        Storage.setData("file-pointers", { 0: [], 1: [] }.serialize());
        FilePointer.init();

        //Create basic files
        createFile({
            uniqueId: 0,
            name: "FileSystemEntry",
            created_at: new Date(),
            updated_at: new Date(),
            executed_at: new Date(),
            directoryId: 0,
            type: 'directory'
        });
        createFile({
            uniqueId: 1,
            name: 'Root',
            created_at: new Date(),
            updated_at: new Date(),
            executed_at: new Date(),
            directoryId: 0,
            type: 'directory'
        });
        createFile({
            uniqueId: 2,
            name: 'System',
            created_at: new Date(),
            updated_at: new Date(),
            executed_at: new Date(),
            directoryId: 1,
            type: 'directory'
        });
        createFile({
            uniqueId: 3,
            name: 'UserData',
            created_at: new Date(),
            updated_at: new Date(),
            executed_at: new Date(),
            directoryId: 1,
            type: 'directory'
        });
        createFile({
            uniqueId: 4,
            name: 'RecycleBin',
            created_at: new Date(),
            updated_at: new Date(),
            executed_at: new Date(),
            directoryId: 1,
            type: 'directory'
        });

        fileCounter = 5;
        Storage.setData("file-counter", 5);

        console.log("FileSystem API: Installed: " + new Date().toGMTString() + ", Key: " + storageKey);
        return true;
    }
    function format() {
        console.log('FileSystem API: Format FS:' + storageKey);
        var keyChecker = new RegExp(storageKey);
        
        for(var key in localStorage) {
            if(keyChecker.test(key)) localStorage.removeItem(key);    
        }
        
        install();      //Install FileSystem
        return true;
    }

    var FilePointer = new function () {
        var tempFilePointers = [];
        var initialized = false;

        //FilePointer.init() : Init the pointers
        this.init = function () {
            //Load pointers from Storage
            tempFilePointers = JSON.parse(Storage.getData('file-pointers'));
            initialized = true;
            return true;
        };

        //FliePointer.save() : Save the pointers
        this.save = function () {
            if (!initialized) {
                console.error('FilePointer API: Pointers are not initialized.');
                return false;
            }

            filePointers = tempFilePointers;
            Storage.setData("file-pointers", filePointers.serialize());
            filePointers = tempFilePointers;
            return true;
        };
        //FilePointer.restore() : Restore the pointers
        this.restore = function () {
            if (!initialized) {
                console.error('FilePointer API: Pointers are not initialized.');
                return false;
            }

            tempFilePointers = filePointers;
            return true;
        };
        //FilePointer.create(int id) : Create the pointer.
        this.create = function (id) {
            if (!initialized) {
                console.error('FilePointer API: Pointers are not initialized.');
                return false;
            }

            tempFilePointers[id] = [];
            return true;
        };
        //FilePointer.delete(int id) : Delete the pointer.
        this.delete = function (id) {
            if (!initialized) {
                console.error('FilePointer API: Pointers are not initialized.');
                return false;
            }

            delete tempFilePointers[id];
            return true;
        }
        //FilePointer.set(int sourceId, int targetId) : Set the pointer.
        this.set = function (sourceId, targetId) {
            if (!initialized) {
                console.error('FilePointer API: Pointers are not initialized.');
                return false;
            }

            if (typeof tempFilePointers[targetId] === 'undefined') {
                console.error('FileSystem API: Pointed File does not exists.');
                return false;
            }

            tempFilePointers[targetId].push(sourceId);
            return true;
        };
        //FilePointer.get(int directoryId) : Get pointer. If directoryId is not given, return whole pointers.
        this.get = function (directoryId) {
            if (!initialized) {
                console.error('FilePointer API: Pointers are not initialized.');
                return false;
            }

            if (typeof directoryId === 'undefined') return tempFilePointers;

            return tempFilePointers[directoryId];
        };
        //FilePointer.unset(int pointerId, int fileId, bool strict) : Release the pointer. If strict is false(default it's true), they will not check the releasing is success.
        this.unset = function (pointerId, fileId, strict) {
            if (!initialized) {
                console.error('FilePointer API: Pointers are not initialized.');
                return false;
            }

            strict = typeof strict === 'undefined' ? true : !!strict;

            var pointer = tempFilePointers[pointerId];
            if (typeof pointer === 'undefined') {
                if (!strict) {
                    console.log('FileSystem API: [Unstrict passed] Pointed File was not existed, but passed.');
                    return true;
                }
                else {
                    console.error('FileSystem API: Pointed File does not exists.');
                    return false;
                }
            }

            var found = false;
            for (var i = 0, len = pointer.length; i < len; i++) {
                if (pointer[i] === fileId) {
                    found = true;
                    pointer.splice(i, 1);
                    tempFilePointers[pointerId] = pointer;
                    break;
                }
            }

            if (!found) {
                console.error('FileSystem API: Releasing non exists file.');
                return false;
            }

            return true;
        };
    };

    /******************************************************************************************************************
     *
     *
     *
     *                                                         FileSystem API's
     *
     *
     *
     ******************************************************************************************************************/

    //createFile() : Create a file
    this.createFile = function (option) {
        if (readOnly) {
            console.error('FileSystem API: FileSystem is read-only.');
            return false;
        }

        option = typeof option === 'object' ? option : {};
        option.uniqueId = generateFileId();

        //Check Directory ID and name
        if (typeof option.directoryId === 'undefined') {
            console.error('FileSystem API: Failed to create file. No Parent directory.');
            return false;
        }
        else if (typeof option.name === 'undefined') {
            console.error('FileSystem API: Failed to create file. File has no name.');
            return false;
        }

        //Check Directory is available to write.
        if (option.directoryId === 0 || option.directoryId === 1 || option.directoryId === 2 || option.directoryId === 4) {
            console.error('FileSystem API: Failed to create file. Access denied.');
            return false;
        }

        //Check Directory exists
        var dirExists = false;
        for (var i in filePointers) {
            if (parseInt(i) === option.directoryId) {
                dirExists = true;
                break;
            }
        }

        if (!dirExists) {
            console.error('FileSystem API: Failed to create file. Directory does not exists.');
            return false;
        }

        //Check there is same named file exists
        var exists = false;
        var filesInParent = FilePointer.get(option.directoryId);
        for (var i = 0, len = filesInParent.length; i < len; i++) {
            var file = Storage.getData('file-' + filesInParent[i]);
            file = JSON.parse(file);

            if (file.name === option.name) {
                exists = true;
                break;
            }
        }

        if (exists) {
            console.error('FileSystem API: Failed to create file. Duplicated File name ' + option.name + '.');
            return false;
        }
        //return false;
        return createFile(option);
    };
    //updateFile() : Update a file
    this.updateFile = function (option) {
        if (readOnly) {
            console.error('FileSystem API: FileSystem is read-only.');
            return false;
        }

        option = typeof option === 'object' ? option : {};

        //Check uniqueId
        if (typeof option.uniqueId === 'undefined') {
            console.error('FileSystem API: Failed to update file. uniqueId must be required.');
            return false;
        }

        //Check the file is available to update
        if (option.uniqueId === 0 || option.uniqueId === 1 || option.uniqueId === 2 || option.uniqueId === 4) {
            console.error('FileSystem API: Failed to update file. Access denied.');
            return false;
        }

        //Validate directory
        if (typeof option.directoryId !== 'undefined') {
            //Check the directory is available
            if (option.directoryId === 0 || option.directoryId === 1 || option.directoryId === 2 || option.directoryId === 4) {
                console.error('FileSystem API: Failed to update file. Access denied.');
                return false;
            }

            //Check Directory exists
            var dirExists = false;
            for (var i in filePointers) {
                if (parseInt(i) === option.directoryId) {
                    dirExists = true;
                    break;
                }
            }

            if (!dirExists) {
                console.error('FileSystem API: Failed to update file. Destination directory does not exists.');
                return false;
            }
        }

        //Check file exists
        if (typeof Storage.getData('file-' + option.uniqueId) === 'undefined') {
            console.error('FileSystem API: File does not exists.');
            return false;
        }

        var originalFile = JSON.parse(Storage.getData('file-' + option.uniqueId));
        if (typeof option.directoryId === 'undefined') option.directoryId = originalFile.directoryId;

        if (typeof option.name === 'undefined') option.name = originalFile.name;

        //Check there is same named file exists
        var exists = false;
        var filesInParent = FilePointer.get(option.directoryId);
        for (var i = 0, len = filesInParent.length; i < len; i++) {
            var file = Storage.getData('file-' + filesInParent[i]);

            file = JSON.parse(file);
            if (file.uniqueId === option.uniqueId) continue;

            if (file.name === option.name) {
                exists = true;
                break;
            }
        }

        if (exists) {
            console.error('FileSystem API: Failed to update file. Duplicated File name ' + option.name + '.');
            return false;
        }
        
        return updateFile(option);
    };
    //removeFile() : Remove a file
    this.removeFile = function (option) {
        if (readOnly) {
            console.error('FileSystem API: FileSystem is read-only.');
            return false;
        }

        option = typeof option === 'object' ? option : {};

        //Check uniqueId
        if (typeof option.uniqueId === 'undefined') {
            console.error('FileSystem API: Failed to update file. uniqueId must be required.');
            return false;
        }

        //Check the directory is available
        if (option.uniqueId === 0 || option.uniqueId === 1 || option.uniqueId === 2 || option.uniqueId === 3 || option.uniqueId === 4) {
            console.error('FileSystem API: Failed to delete file. Access denied.');
            return false;
        }

        //Check file exists
        if (typeof Storage.getData('file-' + option.uniqueId === 'undefined')) {
            console.error('FileSystem API: File does not exists.');
            return false;
        }

        return removeFile(option);
    };
    //getFileById(int uniqueId) : Find a file by ID
    this.getFileById = function (uniqueId) {
        var fileObject = Storage.getData('file-' + uniqueId);

        if (typeof fileObject === 'undefined') {
            console.error('FileSystem API: Failed to get file. File does not exists.');
            return false;
        }

        fileObject = JSON.parse(fileObject);
        
        //Isn't directory? Then add content!
        if (fileObject.type !== 'directory') fileObject.content = Storage.getData('file-content-' + uniqueId);

        return fileObject;
    };
    //scan(int directoryId) : Scan the directory
    this.scan = function (directoryId) {
        //Get Pointed files
        var files = FilePointer.get(directoryId);

        if (typeof files === 'undefined') {
            console.error('FileSystem API: Failed to scan. Directory does not exists.');
            return false;
        }

        return files;
    };
    //serialize() : Serialize File System
    this.serialize = function () {
        var keyChecker = new RegExp(storageKey);
        var serializedFileSystem = {};
        
        serializedFileSystem.backupDate = new Date().toGMTString();
        serializedFileSystem.systemKey = storageKey;
        serializedFileSystem.version = version;
        serializedFileSystem.engine = engine;
        
        for(var key in localStorage) {
            if(key === 'serialize') continue;
            if(key === 'size') continue;
            
            if(keyChecker.test(key)) {
                var item = localStorage[key];
                var tKey = key.replace(storageKey + "_", '');
                serializedFileSystem[tKey] = item;
            }
        }
        
        return serializedFileSystem.serialize();
    };
    //import(FileSystemConstructor importFileSystem) : Import another File System to current File System(overwrite).
    this.import = function (importFileSystem) {
        var deserialized = {};
        
        try {
            deserialized = JSON.parse(importFileSystem);
        }
        catch(exception) {
            deserialized = false;
            console.error('FileSystem API: Failed to import FileSystem. Unknown FileSystem.');
        }
        
        if(!deserialized) return false;
        
        if(typeof deserialized.backupDate !== 'undefined' && typeof deserialized.systemKey !== 'undefined' && typeof deserialized.version !== 'undefined' && typeof deserialized.engine !== 'undefined') {
            console.log('FileSystem: Load FileSystem...');
            
            if(deserialized.engine === engine) {
                version = deserialized.version;
                engine = deserialized.engine;
                
                console.log('FileSystem Imported.');
                console.log('Backup Date: ' + deserialized.backupDate);
                console.log('Storage Key: ' + deserialized.systemKey);
                console.log('Version: ' + deserialized.version);
                console.log('Engine: ' + deserialized.engine);
                
                //FORMAT!!!!!!
                format();
                
                //Time to create files!
                for(var key in deserialized) {
                    if(key === 'size') continue;
                    if(key === 'serialize') continue;
                    if(key === 'backupDate') continue;
                    if(key === 'systemKey') continue;
                    if(key === 'version') continue;
                    if(key === 'engine') continue;
                    
                    Storage.setData(storageKey + "_" + key, deserialized[key]);
                }    
            }
            else {
                console.error('FileSystem API: Failed to import FileSystem. Unsupported FileSystem Engine ' + deserialized.engine + '.');
                return false;   
            }
        }
        else{
            console.error('FileSystem API: Failed to import FileSystem. Unknown FileSystem.')
            return false;
        }
        
        return true;
    };
    //FileSystem.format() : Format the FileSystem.
    this.format = function() {
        return format();
    };


    //Initialize FileSystem
    function onInit() {
        //No FileSystem installed
        var installed = Storage.getData("installed");

        if (typeof installed === "undefined") {
            install();
        }
        else {
            fileCounter = parseInt(Storage.getData("file-counter"));
            filePointers = JSON.parse(Storage.getData("file-pointers"));
            FilePointer.init();

            console.log('FileSystem loaded: ' + storageKey);
        }
    };
    
    onInit();
}

//Crypto : SHA-256 creation object
//based : sha256 - MIT Licensed by Chris Veness, 2005-2014
//Source from : http://www.movable-type.co.uk/scripts/sha256.html
if (typeof String.prototype.utf8Encode == 'undefined') {
    String.prototype.utf8Encode = function () {
        return unescape(encodeURIComponent(this));
    };
}
if (typeof String.prototype.utf8Decode == 'undefined') {
    String.prototype.utf8Decode = function () {
        try {
            return decodeURIComponent(escape(this));
        } catch (e) {
            return this; // invalid UTF-8? return as-is
        }
    };
}

window.Crypto = new function () {
    this.hash = function (msg) {
        msg = msg.toString();
        // convert string to UTF-8, as SHA only deals with byte-streams
        msg = msg.utf8Encode();

        // constants [§4.2.2]
        var K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
        // initial hash value [§5.3.1]
        var H = [
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

        // PREPROCESSING 

        msg += String.fromCharCode(0x80);  // add trailing '1' bit (+ 0's padding) to string [§5.1.1]

        // convert string msg into 512-bit/16-integer blocks arrays of ints [§5.2.1]
        var l = msg.length / 4 + 2; // length (in 32-bit integers) of msg + ‘1’ + appended length
        var N = Math.ceil(l / 16);  // number of 16-integer-blocks required to hold 'l' ints
        var M = new Array(N);

        for (var i = 0; i < N; i++) {
            M[i] = new Array(16);
            for (var j = 0; j < 16; j++) {  // encode 4 chars per integer, big-endian encoding
                M[i][j] = (msg.charCodeAt(i * 64 + j * 4) << 24) | (msg.charCodeAt(i * 64 + j * 4 + 1) << 16) |
                          (msg.charCodeAt(i * 64 + j * 4 + 2) << 8) | (msg.charCodeAt(i * 64 + j * 4 + 3));
            } // note running off the end of msg is ok 'cos bitwise ops on NaN return 0
        }
        // add length (in bits) into final pair of 32-bit integers (big-endian) [§5.1.1]
        // note: most significant word would be (len-1)*8 >>> 32, but since JS converts
        // bitwise-op args to 32 bits, we need to simulate this by arithmetic operators
        M[N - 1][14] = ((msg.length - 1) * 8) / Math.pow(2, 32); M[N - 1][14] = Math.floor(M[N - 1][14]);
        M[N - 1][15] = ((msg.length - 1) * 8) & 0xffffffff;


        // HASH COMPUTATION [§6.1.2]

        var W = new Array(64); var a, b, c, d, e, f, g, h;
        for (var i = 0; i < N; i++) {

            // 1 - prepare message schedule 'W'
            for (var t = 0; t < 16; t++) W[t] = M[i][t];
            for (var t = 16; t < 64; t++) W[t] = (this.σ1(W[t - 2]) + W[t - 7] + this.σ0(W[t - 15]) + W[t - 16]) & 0xffffffff;

            // 2 - initialise working variables a, b, c, d, e, f, g, h with previous hash value
            a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];

            // 3 - main loop (note 'addition modulo 2^32')
            for (var t = 0; t < 64; t++) {
                var T1 = h + this.Σ1(e) + this.Ch(e, f, g) + K[t] + W[t];
                var T2 = this.Σ0(a) + this.Maj(a, b, c);
                h = g;
                g = f;
                f = e;
                e = (d + T1) & 0xffffffff;
                d = c;
                c = b;
                b = a;
                a = (T1 + T2) & 0xffffffff;
            }
            // 4 - compute the new intermediate hash value (note 'addition modulo 2^32')
            H[0] = (H[0] + a) & 0xffffffff;
            H[1] = (H[1] + b) & 0xffffffff;
            H[2] = (H[2] + c) & 0xffffffff;
            H[3] = (H[3] + d) & 0xffffffff;
            H[4] = (H[4] + e) & 0xffffffff;
            H[5] = (H[5] + f) & 0xffffffff;
            H[6] = (H[6] + g) & 0xffffffff;
            H[7] = (H[7] + h) & 0xffffffff;
        }

        return this.toHexStr(H[0]) + this.toHexStr(H[1]) + this.toHexStr(H[2]) + this.toHexStr(H[3]) +
               this.toHexStr(H[4]) + this.toHexStr(H[5]) + this.toHexStr(H[6]) + this.toHexStr(H[7]);
    };
    this.ROTR = function (n, x) {
        return (x >>> n) | (x << (32 - n));
    };

    this.Σ0 = function (x) { return this.ROTR(2, x) ^ this.ROTR(13, x) ^ this.ROTR(22, x); };
    this.Σ1 = function (x) { return this.ROTR(6, x) ^ this.ROTR(11, x) ^ this.ROTR(25, x); };
    this.σ0 = function (x) { return this.ROTR(7, x) ^ this.ROTR(18, x) ^ (x >>> 3); };
    this.σ1 = function (x) { return this.ROTR(17, x) ^ this.ROTR(19, x) ^ (x >>> 10); };
    this.Ch = function (x, y, z) { return (x & y) ^ (~x & z); };
    this.Maj = function (x, y, z) { return (x & y) ^ (x & z) ^ (y & z); };

    this.toHexStr = function (n) {
        // note can't use toString(16) as it is implementation-dependant,
        // and in IE returns signed numbers when used on full words
        var s = "", v;
        for (var i = 7; i >= 0; i--) { v = (n >>> (i * 4)) & 0xf; s += v.toString(16); }
        return s;
    };
}