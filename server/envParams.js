process.env.DEVICES = `[
    {
        "id":"webapi-A",
        "name":"wApi",
        "type":"WebAPI",
        "configs": {
            "getTags":"http://localhost:8081/tags",
            "postTags":"http://localhost:8081/tags",
            "requestTimeoutMs":5000,
            "requestIntervalMs":500
        }
    }
]`
;