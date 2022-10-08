const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NetworkTestSchema = new Schema ({
    speedTest: {
        type: Object,
        required: true
    },
    dateOfEntry: {
        type: Date,
        default: Date.now()
    }
})

module.exports = Item = mongoose.model('networkTests', NetworkTestSchema);