

Install frontend packages (@angular/elements do build web component are missing and have some dependency conflict):
```
cd ./client
npm install --legacy-peer-deps
```

To Debug
```
npm run client
http://localhost:4200/ (browser)
```

To build for production
```
ng build --configuration=client
```
or 
```
ng build --configuration=client --optimization false --output-hashing none
```

