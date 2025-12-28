#Esecuzione con Docker

## Prerequisiti
Docker installato sul sistema

## Build dell'immagine
docker build -t psm .

## Avvio del container
docker run -d -p 8080:3000 --name psm-container psm

## Accesso all'applicazione
Apri il browser e vai su: http://localhost:8080

## Comandi utili
Visualizza logs
docker logs -f psm-container

Ferma il container
docker stop psm-container

Riavvia il container
docker start psm-container

Rimuovi il container
docker rm psm-container


