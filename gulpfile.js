var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

gulp.task('default', function() {
    gulp.src('src/vfs.js')
    .pipe(gulp.dest('product'));
    
    gulp.src('src/vfs.js')
    .pipe(uglify())
    .pipe(rename('vfs.min.js'))
    .pipe(gulp.dest('product'));
});