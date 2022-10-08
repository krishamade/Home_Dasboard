//Clock Functionality
var datetime = null,
    date = null;

var update = function () {
    date = moment(new Date())
    datetime.html(date.format('dddd, MMMM Do h:mm:ss a'));
};

$(document).ready(function () {
    datetime = $('#datetime')
    update();
    setInterval(update, 1000);
});