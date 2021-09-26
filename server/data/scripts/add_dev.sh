#/bin/sh -v

DEV_NAME=d_12345670-12345670

curl http://127.0.0.1:1881/api/device -XPOST \
    -H "Content-Type: application/json" \
    -d '{"headers":{"normalizedNames":{},"lazyUpdate":null},"params":{"query":"security","name":"d_12345670-12345670","value":null}}'

curl http://127.0.0.1:1881/api/projectData -XPOST \
    -H "Content-Type: application/json" \
    -d "$(cat ./data/scripts/template.json)"