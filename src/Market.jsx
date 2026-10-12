import { useEffect, useState } from 'react';
import { ArrowUpRight, BarChart3, RefreshCw, Radio, ShieldCheck } from 'lucide-react';
import { fetchMarketPrice, marketCards } from './market.js';

function initialResults() {
  return Object.fromEntries(marketCards.map(card => [card.id, { status: 'loading' }]));
}

export default function Market() {
  const [refresh, setRefresh] = useState(0);
  const [results, setResults] = useState(initialResults);
  const loading = Object.values(results).some(result => result.status === 'loading');
  const failed = Object.values(results).some(result => result.status === 'error');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setResults(initialResults());
    const timeout = setTimeout(() => controller.abort(), 10000);
    Promise.allSettled(marketCards.map(card => fetchMarketPrice(card.id, { signal: controller.signal }))).then(outcomes => {
      clearTimeout(timeout);
      if (!active) return;
      setResults(Object.fromEntries(outcomes.map((outcome, index) => [marketCards[index].id,
        outcome.status === 'fulfilled' ? { status: outcome.value ? 'success' : 'unavailable', price: outcome.value } : { status: 'error' },
      ])));
    });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [refresh]);

  return <section className="market-section" id="mercado" aria-labelledby="market-title"><div className="container market-inner">
    <div className="market-copy"><span className="eyebrow"><BarChart3 size={14} /> RADAR TCG / TU GUÍA DE COLECCIÓN</span><h2>Antes de atraparla,<br />{' '}<span>conoce su valor.</span></h2><p>Una mirada al mercado de cartas Pokémon. Consulta referencias internacionales y conversemos sobre el precio y la disponibilidad para tu colección.</p><a className="market-source" href="https://tcgdex.dev/markets-prices" target="_blank" rel="noreferrer"><ShieldCheck size={14} /> Datos de TCGdex · TCGplayer y Cardmarket <ArrowUpRight size={12} /></a></div>
    <div className="market-board"><div className="market-board-top"><span><Radio size={13} /> REFERENCIAS DEL MERCADO</span><button className="refresh-market" disabled={loading} onClick={() => setRefresh(value => value + 1)} aria-label="Actualizar precios del mercado"><RefreshCw size={12} className={loading ? 'spinning' : ''} /> {loading ? 'Consultando' : 'Actualizar'}</button></div>
      <div aria-live="polite">{marketCards.map((card, index) => {
        const result = results[card.id];
        const price = result?.price;
        return <article className="market-row" key={card.id}><span className="market-number">0{index + 1}</span><div className="market-card-info"><h3>{card.name}</h3><span>{card.set} · #{card.number}</span></div><div className="market-price">{price ? <><strong>{new Intl.NumberFormat('es-CL', { style: 'currency', currency: price.currency, currencyDisplay: 'code', minimumFractionDigits: 2 }).format(price.price)}</strong><span>{price.source} · {new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(price.updatedAt))}</span></> : <><strong>—</strong><span>{result?.status === 'loading' ? 'Consultando referencia…' : result?.status === 'unavailable' ? 'Sin referencia disponible' : 'Referencia no disponible'}</span></>}<a href={price?.source === 'Cardmarket' ? 'https://www.cardmarket.com/en/Pokemon' : card.tcgplayerUrl} target="_blank" rel="noreferrer">Ver fuente <ArrowUpRight size={10} /></a></div></article>;
      })}</div>
      {failed && <p className="market-error">No pudimos consultar los precios. Puedes abrir la fuente o volver a intentarlo.</p>}
      <p className="market-footnote">Valores de referencia en USD o EUR, sin conversión a pesos chilenos. No son precios de venta. La edición, el idioma, el estado y el envío pueden cambiar el valor.</p>
    </div>
  </div></section>;
}
