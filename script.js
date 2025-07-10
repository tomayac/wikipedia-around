const positionButton = document.querySelector(".position");
const latitudeSpan = document.querySelector(".latitude");
const longitudeSpan = document.querySelector(".longitude");
const geocodeSpan = document.querySelector(".geocode");
const mapImg = document.querySelector(".map");
const articleUl = document.querySelector(".articles");

const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      success => {
        resolve(success);
      },
      error => {
        reject(error);
      },
      { timeout: 10_000, maximumAge: 60_000, enableHighAccuracy: false }
    );
  });
};

const updateLabels = (latitude, longitude) => {
  if (typeof latitude === "number") {
    latitudeSpan.textContent = latitude.toFixed(6);
    longitudeSpan.textContent = longitude.toFixed(6);
  } else {
    latitudeSpan.textContent = "Offline, cannot determine latitude";
    longitudeSpan.textContent = "longitude";
  }
};

const geocode = async (latitude, longitude) => {
  const url = `https://local-reverse-geocoder.tomayac.com/geocode?latitude=${latitude}&longitude=${longitude}&maxResults=1`;
  try {
    const response = await fetch(url);
    if (!response.ok || response.status !== 200) {
      throw new Error(`Fetch failed (${response.status})`);
    }
    const json = await response.json();
    geocodeSpan.textContent = `${json[0][0].name}${json[0][0].admin1Code.name ? `, ${json[0][0].admin1Code.name}` : ''}`;
  } catch (error) {
    console.error(error.name, error.message);
  }
};

const updateMap = (latitude, longitude) => {
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?autoscale=1&size=400x300&maptype=roadmap&key=AIzaSyBWZnCRi6oar3MTjR0HkR1lK52_mTe0Rks&format=png&visual_refresh=true&markers=size:tiny%7Ccolor:0xff0000%7Clabel:%7C${latitude},${longitude}&scale=2`;
  mapImg.srcset = `${mapUrl} 2x`;
};

const listArticles = async articles => {
  const noArticles = !articles.length;
  if (noArticles) {
    articles .push({
      title: "Nothing around has a Wikipedia article",
      extract: "See something interesting? Write about it!",
    })
  }

  const fragment = document.createDocumentFragment();
  for (const article of articles) {
    const li = document.createElement("li");

    const h2 = document.createElement("h2");
    h2.textContent = article.title;
    li.append(h2);

    if (article.extract) {
      const p = document.createElement("p");
      p.textContent = article.extract;
      li.append(p);

      const a = document.createElement("a");
      a.textContent = noArticles ? "Learn how" : "Read more";
      a.target = "_blank";
      a.href = noArticles ? 'https://en.wikipedia.org/wiki/Help:Your_first_article' : `https://en.wikipedia.org/wiki/${encodeURIComponent(
        article.title
      )}`;
      li.append(a);
    }

    fragment.append(li);
  }
  articleUl.innerHTML = "";
  articleUl.append(fragment);
};

const getArticlesAround = async (latitude, longitude) => {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=1000&origin=*&format=json&gscoord=${latitude}|${longitude}`;
  try {
    const response = await fetch(url, {
      headers: { origin: location.href }
    });
    if (!response.ok || response.status !== 200) {
      throw new Error(`Fetch failed (${response.status})`);
    }
    const json = await response.json();
    return json.query.geosearch;
  } catch (error) {
    console.error(error.name, error.message);
  }
};

const getArticleSummary = async pageId => {
  const url = `https://en.wikipedia.org/w/api.php?format=json&origin=*&action=query&prop=extracts&exintro&explaintext&redirects=1&pageids=${pageId}`;
  try {
    const response = await fetch(url, {
      headers: { origin: location.href }
    });
    if (!response.ok || response.status !== 200) {
      throw new Error(`Fetch failed (${response.status})`);
    }
    const json = await response.json();
    return json.query.pages[pageId].extract;
  } catch (error) {
    console.error(error.name, error.message);
  }
};

positionButton.addEventListener("click", async () => {
  positionButton.disabled = true;
  try {
    const { latitude, longitude } = (await getCurrentPosition()).coords;
    updateLabels(latitude, longitude);
    geocode(latitude, longitude);
    updateMap(latitude, longitude);
    const articles = await getArticlesAround(latitude, longitude);
    const extracts = await Promise.all(
      articles
        .map(article => article.pageid)
        .map(pageId => {
          return getArticleSummary(pageId);
        })
    );
    articles.map((article, i) => {
      article.extract = extracts[i];
      return article;
    });
    listArticles(articles);
  } catch (error) {
    console.error(error.name || "Error,", error.message);
    updateLabels();
  } finally {
    if (navigator.onLine) {
      positionButton.disabled = false;
    }
  }
});

window.addEventListener("offline", () => {
  console.log("📍", "Offline");
  positionButton.disabled = true;
  positionButton.classList.add("offline");
});

window.addEventListener("online", () => {
  console.log("📍", "Online");
  positionButton.disabled = false;
  positionButton.classList.remove("offline");
});

if (!navigator.onLine) {
  positionButton.disabled = true;
  positionButton.classList.add("offline");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "./serviceworker.js"
      );
      console.log("📍", "Service Worker registered.", registration);
    } catch (err) {
      console.error(err.name, err.message);
    }
  });
}
