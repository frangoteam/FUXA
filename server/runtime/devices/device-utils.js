'use strict';
module.exports = {

    tagDaqToSave: function (tag, timestamp) {
        if (tag.daq && tag.daq.enabled) {
            const a = timestamp - parseInt(tag.daq.interval) * 1000;
            if (tag.changed && tag.daq.changed) {
                return true;
            } else if (!tag.daq.lastDaqSaved || timestamp - parseInt(tag.daq.interval) * 1000 > tag.daq.lastDaqSaved) {
                tag.daq.lastDaqSaved = timestamp;
                return true;
            }
        }
        return false;
    }
}