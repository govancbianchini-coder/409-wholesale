import { q } from "./db";

// One row per dealer contact with engagement + win metrics.
export async function dealerStats({ where = "NOT c.archived", params = [], order = "bids DESC, wins DESC, c.dealership", limit = 1000 } = {}) {
  return q(
    `WITH best AS (
       SELECT vehicle_id, contact_id, max(amount) amount, max(created_at) last_bid
       FROM bids WHERE NOT superseded GROUP BY vehicle_id, contact_id
     ),
     awarded AS (
       SELECT v.id vehicle_id, b.contact_id winner_id, b.amount winning
       FROM vehicles v JOIN bids b ON b.id = v.winning_bid_id WHERE v.status = 'awarded'
     )
     SELECT c.*,
       (SELECT count(*) FROM invitations i WHERE i.contact_id = c.id AND i.sent_at IS NOT NULL)::int AS invites,
       (SELECT count(*) FROM invitations i WHERE i.contact_id = c.id AND i.first_viewed_at IS NOT NULL)::int AS views,
       (SELECT count(*) FROM best WHERE best.contact_id = c.id)::int AS bids,
       (SELECT count(*) FROM awarded a WHERE a.winner_id = c.id)::int AS wins,
       (SELECT coalesce(sum(a.winning),0) FROM awarded a WHERE a.winner_id = c.id)::bigint AS won_value,
       (SELECT round(avg((a.winning - best.amount)::numeric / nullif(a.winning,0)) * 100, 1)
          FROM best JOIN awarded a ON a.vehicle_id = best.vehicle_id
          WHERE best.contact_id = c.id AND a.winner_id <> c.id) AS avg_gap_pct,
       greatest((SELECT max(last_bid) FROM best WHERE best.contact_id = c.id),
                (SELECT max(first_viewed_at) FROM invitations i WHERE i.contact_id = c.id)) AS last_active
     FROM contacts c
     WHERE ${where}
     ORDER BY ${order}
     LIMIT ${Number(limit)}`,
    params
  );
}

// Units with their bid summary.
export async function unitRows({ where = "TRUE", params = [], order = "v.created_at DESC", limit = 500 } = {}) {
  return q(
    `WITH best AS (
       SELECT vehicle_id, contact_id, max(amount) amount FROM bids WHERE NOT superseded GROUP BY vehicle_id, contact_id
     ), ranked AS (
       SELECT vehicle_id, amount, contact_id, row_number() OVER (PARTITION BY vehicle_id ORDER BY amount DESC) rn FROM best
     )
     SELECT v.*,
       (SELECT url FROM photos p WHERE p.vehicle_id = v.id ORDER BY sort, id LIMIT 1) AS photo,
       (SELECT count(*) FROM photos p WHERE p.vehicle_id = v.id)::int AS photo_count,
       (SELECT count(*) FROM invitations i WHERE i.vehicle_id = v.id AND i.sent_at IS NOT NULL)::int AS invites,
       (SELECT count(*) FROM invitations i WHERE i.vehicle_id = v.id AND i.first_viewed_at IS NOT NULL)::int AS views,
       (SELECT count(*) FROM best WHERE best.vehicle_id = v.id)::int AS bid_count,
       (SELECT amount FROM ranked r WHERE r.vehicle_id = v.id AND rn = 1) AS top_bid,
       (SELECT amount FROM ranked r WHERE r.vehicle_id = v.id AND rn = 2) AS second_bid,
       (SELECT c.dealership FROM ranked r JOIN contacts c ON c.id = r.contact_id WHERE r.vehicle_id = v.id AND rn = 1) AS top_dealer,
       (SELECT c.dealership || ' · ' || c.first_name FROM bids b JOIN contacts c ON c.id = b.contact_id WHERE b.id = v.winning_bid_id) AS winner,
       (SELECT d.name FROM dealerships d WHERE d.id = v.seller_dealership_id) AS seller_name
     FROM vehicles v
     WHERE ${where}
     ORDER BY ${order}
     LIMIT ${Number(limit)}`,
    params
  );
}
