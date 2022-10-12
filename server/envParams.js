process.env.DEVICES = `[
    {
        "id":"webapi-A",
        "name":"wApi",
        "type":"WebAPI",
        "configs": {
            "getTags":"http://192.168.1.177:1888/api/tags",
            "postTags":"http://192.168.1.177:1888/api/tags",
            "requestTimeoutMs":5000,
            "requestIntervalMs":500
        }
    }
]`
;