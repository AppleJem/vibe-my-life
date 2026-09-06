/**
 * A pot of money, held somewhere, worth a known amount today.
 *
 * Deliberately *not* called an "account": that word is reserved for the source of a
 * spend — which bank account or card an expense came from — which the expense tracker
 * may want later. A holding is the stock, an expense is the flow, and nothing links
 * the two.
 */
export interface Holding {
  id: string
  /** What the user calls it — "Housing fund", "DBS fixed deposit". */
  name: string
  /**
   * The balance as held, in `currency`, and never converted at rest.
   *
   * Unlike `Expense.amount` there is no base-currency figure stored alongside it and no
   * rate snapshot: an expense is a historical event whose rate is fixed forever, whereas
   * a balance is a present-value figure that a stale snapshot would quietly misreport.
   * The conversion happens in the client, at read time, against live rates.
   */
  amount: number
  /** ISO code the balance is held in. Always present, unlike `Expense.currency`. */
  currency: string
  /**
   * A single normalized label — trimmed, inner whitespace collapsed, lowercased.
   * `''` means untagged. One tag rather than many so the chart can group by it without
   * having to split or double-count a holding.
   */
  tag: string
  /** Free-form: started when, why, the interest rate at the time, maturity date… */
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CreateHoldingInput {
  name: string
  amount: number
  currency: string
  tag?: string
  notes?: string
}

/** Every field optional — the editor sends the whole record, but a partial patch is valid. */
export interface UpdateHoldingInput {
  name?: string
  amount?: number
  currency?: string
  tag?: string
  notes?: string
}
