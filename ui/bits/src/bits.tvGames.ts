import * as xhr from 'common/xhr';
import { pubsub } from 'common/pubsub';

interface ReplacementResponse {
  id: string;
  html: string;
}

const getId = (el: EleLoose) => el.getAttribute('href')?.substring(1, 9);

let isRequestPending = false;
const finishedIdQueue: string[] = [];

const requestReplacementGame = () => {
  // Make sure to only make one request at a time.
  // This avoids getting copies of the same game to replace two different finished games.
  if (isRequestPending) return;
  const oldId = finishedIdQueue.shift();
  if (!oldId) return;
  isRequestPending = true;

  // Use requestAnimationFrame to avoid requesting games in background tabs
  requestAnimationFrame(() => {
    const main = $('main.tv-games');
    const url = new URL(main.data('rel').replace('gameId', oldId));
    main.find('.mini-game').each((_i, el) => url.searchParams.append('exclude', getId(el)!));
    xhr
      .json(url.toString())
      .then((data: ReplacementResponse) => {
        main.find(`.mini-game[href^="/${oldId}"]`).replaceWith(data.html);
        if (data.html.includes('mini-game__result')) window.lichess.overrides.tvGamesOnFinish(data.id);
        window.lichess.initializeDom();
      })
      .then(done, done);
  });
};

const done = () => {
  isRequestPending = false;
  requestReplacementGame();
};

window.lichess.overrides.tvGamesOnFinish = (id: string) =>
  setTimeout(() => {
    finishedIdQueue.push(id);
    requestReplacementGame();
  }, 7000); // 7000 matches the rematch wait duration in /modules/tv/main/Tv.scala

site.load.then(() => {
  pubsub.on('socket.in.finish', ({ id }) => window.lichess.overrides.tvGamesOnFinish(id));
  $('main.tv-games')
    .find('.mini-game')
    .each((_i, el) => {
      if ($(el).find('.mini-game__result').length > 0) window.lichess.overrides.tvGamesOnFinish(getId(el)!);
    });
});
