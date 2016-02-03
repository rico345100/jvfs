# JavaScript Virtual File System v1.0.0

JavaScript virtual file system(short as JSVF) is local-storage based, light weight file system.
Everytime create the project, you need to develop 'how to save the data' on the web.
Especially, Web-Apps like Apache Cordova, you can use localStorage or IndexedDB etc...

LocalStorage is very easy to use, but hard to simulate the file system.
The JSVF makes this easier into your code.


## - How to use?

First, include the vfs.js or vfs.min.js.


Second, create FileSystem object with specifying key.

```javascript
var	fileSystem = new FileSystem({ key: 'fs1' });
```

* key is unique id to find specific file system, so do not forget!


Third, do anything you want!


## - Methods
* FileSystem.createFile(FileObject) : Create an empty file.
* FileSystem.updateFile(FileObject) : Edit a file.
* FileSystem.removeFile(FileObject) : Remove a file.
* FileSystem.getFileById(int ID) : get file by id.
* FileSystem.scan(int directoryId) : Scan whole directory with id(directory is also file).
* FileSystem.serialize() : Serialize the file system. most of this, use for backup.
* FileSystem.import(FileSystem) : Load serialized file system. Most of this, use for recoverying.
* FileSystem.format() : Initialize file system.


## - Create a file
to create file, use createFile method.

```javascript
fileSystem.createFile({ name: 'Helloworld.txt', directoryId: 3, content: 'Helloworld' });
```

or, you can use FileObject constructor to create file.

```javascript
var tempFile = new FileObject({ name: 'Helloworld2.txt', directoryId: 3, content: 'Hello!'});
fileSystem.createFile(tempFile);
```
or, you can use even shorter.

```javascript
fileSystem.createFile(new FileObject({ name: 'Helloworld3.txt', directoryId: 3, content: 'Hi!' }));
```

choose your favorite.


JVFS support those file properties:
* uniqueId = unique id for file. you don't have to specifiy it. file system generate automatically.
* directoryId = directory id. this means the location of file. in ease, it means id of parent directory.
* name = name of the file.
* type = type of the file. there is no type limitation yet. recommend to use MIME type to avoid confusing.
* created_at = date of created. you can't modify it.
* updated_at = date of updated. you can't modify it.
* executed_at = date of executed. you can't modify it.
* content = content of file. directory files cannot have this.
* readOnly = it it is set, you can't update the file after created.


## - System Directories
there are some pre-created directories for file system. most of them are unused but you cannot manipulate them.
each number means the id of the directory(file). 'X' means you can't do anything, 'R' means read-only, 'RWX': means Read/Write/Execute.

* 0: FileSystemEntry (X)
* 1: Root (R)
* 2: System (R)
* 3: UserData (RW)
* 4: RecycleBin (R)


as you can see, you can only use UserData(id:3). above examples for creating file are create file into directoryId:3, that means UserData directory.


## - Update file
you can update the file with updateFile method. this method use 'uniqueId' property to find specific file.

```javascript
fileSystem.updateFile({ uniqueId: 5 });
```

this means update the file with id 5. you should specifiy all properies to edit into first parameter with uniqueId.

```javascript
fileSystem.updateFile({ uniqueId: 5, content: 'Farewell!' });
```

don't forget: you can't edit id of the file.


## - Remove file
you can remove the file easily. and if the file is directory, whole file under the directory also removed.


## - Scan files
you can scan the files in specific directory. use scan method.

```javascript
var fileSystem = new FileSystem({ key: 'fs1' });
var filesInRoot = fileSystem.scan(1);	//Scan the root directory. result is array of file id.

for(var i = 0, len = filesInRoot.length; i < len; i++) {
	console.log( fileSystem.getFileById(filesInRoot[i]).serialize() );
}
```


## - Thanks for
i used javascript sha256 function created by Chris Veness, 2005-2014. thanks.
you can find his source code here: http://www.movable-type.co.uk/scripts/sha256.html
