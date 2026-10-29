import { extract } from '@extractus/article-extractor';

export async function fetchArticle(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('This is not a valid URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.');
  const article = await extract(url.href);
  const content = (article?.content || article?.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (content.length < 150) throw new Error('The page did not provide enough readable article text. It may be blocked or paywalled.');
  return { url: url.href, title: article.title || url.hostname, text: content.slice(0, 12000), status: 'ok' };
}
