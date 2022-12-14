const util = {
    send(...params) {
        const messages = Array.prototype.filter.call(arguments, item => item);
        const response = Array.prototype.join.call(messages, '&');

        return response;
    },

    read(message, param, mode = 'tap', options = {}) {
        return `read=${getMessage(message)}=${getReadDef(param, mode, options)}`;
    },
    go_to_folder(folder) {
        return `go_to_folder=/${folder}`;
    },
    id_list_message(message) {
        return `id_list_message=${getMessage(message)}.`;
    },
    routing_yemot(route) {
        return `routing_yemot=${route}`;
    },
    hangup() {
        return `go_to_folder=hangup`;
    },

    id_list_message_v2(text) {
        return util.id_list_message({ type: 'text', text });
    },
    read_v2(text, param, options = {}) {
        return util.read({ type: 'text', text }, param, 'tap', options);
    }
}

export default util;

const messageType = {
    "file": "f",
    "text": "t",
    "speech": "s",
    "digits": "d",
    "number": "n",
    "alpha": "a"
};

function getMessage(message) {
    if (Array.isArray(message))
        return message.map(getMessage).join('.');

    return `${messageType[message.type]}-${message.text}`;
}

function getReadDef(param, mode, options) {
    let res = [param];
    switch (mode) {
        case 'tap':
            res.push(options.use_previous_if_exists ? "yes" : "no");
            res.push(options.max || "*");
            res.push(options.min || "1");
            res.push(options.sec_wait || 7);
            res.push(options.play_ok_mode || "No");
            res.push(options.block_asterisk ? "yes" : "no");
            res.push(options.block_zero ? "yes" : "no");
            res.push(options.replace_char || "");
            res.push(options.digits_allowed ? options.digits_allowed.join(".") : ""); // [1, 14]
            res.push(options.amount_attempts || "");
            res.push(options.read_none ? "Ok" : "no");
            res.push(options.read_none_var || "");
            break;

        case "record":
            res.push(options.use_previous_if_exists ? "yes" : "no");
            res.push("record");
            res.push(options.path || "");
            res.push(options.file_name || "");
            res.push(options.record_ok === false ? "no" : "yes");
            res.push(options.record_hangup ? "yes" : "no");
            res.push(options.record_attach ? "yes" : "no");
            res.push(options.lenght_min || "");
            res.push(options.lenght_max || "");
            break;

        case "voice":
            res.push(options.use_previous_if_exists ? "yes" : "no");
            res.push("voice");
            res.push(options.lang || "");
            res.push(options.allow_typing ? "yes" : "no");
            res.push(options.max_typing_digits || "");
            res.push(options.record_engine ? "record" : "");
            res.push(options.lenght_min || "");
            res.push(options.lenght_max || "");
            break;

        default:
            break;
    }
    return res.join(',');
}
