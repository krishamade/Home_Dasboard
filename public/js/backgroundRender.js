function setBackground() {
    //Add Date and Time Information
    var today = new Date();
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var timeHour = today.getHours()
    var dateTime = date + ' ' + time;

    //Set Background Image to Day/Night depending on the time
/*     if (timeHour <= 8) {
        $('.bodyDay').css("background-image",
            'linear-gradient(to bottom right, rgba(13, 12, 15), rgba(45, 44, 42), rgba(80, 78, 84))')
    } else if (timeHour > 20) {
        $('.bodyDay').css("background-image",
            'linear-gradient(to bottom right, rgba(252,194,161), rgba(253,197,160), rgba(103,80,126), rgba(57,49,85))'
        )
    } */

}