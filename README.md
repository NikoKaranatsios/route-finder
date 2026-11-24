# Honeymoon Atlas

A map-first route builder for a two-person trip from Bangkok on 10 January 2027 to Seoul on 31 March 2027. Choose each next stop, compare hotels, and add restaurants, attractions, shops and activities before confirming a stay.

## Run with Docker

Install Docker with Compose, then run:

```sh
git clone https://github.com/NikoKaranatsios/route-finder.git
cd route-finder
docker compose up --build -d
```

Open [localhost:8080](http://localhost:8080). Stop the server with `docker compose down`. To use a different port, run `PORT=9090 docker compose up --build -d`. To serve other devices on the same network, use `BIND_ADDRESS=0.0.0.0 docker compose up --build -d` and open the host’s address on port 8080.

With Docker alone:

```sh
docker build -t honeymoon-atlas .
docker run --rm -p 127.0.0.1:8080:8080 honeymoon-atlas
```

The image serves the bundled website with an unprivileged Nginx process. All maps, model inputs, and venue records ship in the image. External venue, booking, and workbook links require internet access. The planner can also be served with `python3 -m http.server 8080 --bind 127.0.0.1 --directory dist`.

## Build a route

1. Start in Bangkok. Select a suggested destination on the map to open its detail panel.
2. Compare nights, hotels, restaurants, attractions, and the six local criteria. Add places and confirm the stop to see the next connections.
3. Open **Your route** to review selected stays, costs and the remaining nights. **Criteria** changes local weights. **Preferences** changes the budget, interests, pace, and Tokyo cap.
4. Use **Save** for named versions or export/import a JSON copy between devices. Drafts live in the current browser and origin. **Full routes** opens the original catalog editor.

## Data and scoring

The bundled snapshot contains 16 destinations, 37 directed transfers, 124 complete route templates, 317 lodging records and 955 local places. The local score uses price, cleanliness, safety, accessibility, internet and authenticity. The Scores panel identifies missing values, country-level proxies and editorial judgments. Next-stop ranking blends the local score (35%) and best modeled complete trip fit (65%), prioritizing continuations that satisfy the trip constraints. Prices are planning estimates for two. Personal hotel and place choices affect the total. Unpriced entries are identified in the place panel.

- `dist/trip-data.js` holds destinations, hotels, transfers, defaults, and route templates.
- `dist/places.js` and `dist/evidence.js` hold venue and scoring evidence and source links.
- `dist/model.js` evaluates complete routes. `dist/graph.js` evaluates next stops, lodging choices and plausible continuations.
- `dist/walk.js`, `dist/walkmap.js`, and `dist/walk.css` implement the map-first interface. The catalog editor is in `dist/app.js`.

[Planning workbook](https://docs.google.com/spreadsheets/d/1bcy9wvzmzqiQ_lvGEz8TEcytdYYt5425xVM0ykQW3YA/edit)

