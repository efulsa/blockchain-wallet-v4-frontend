import {
  all,
  allPass,
  anyPass,
  compose,
  curry,
  filter,
  includes,
  isEmpty,
  map,
  path,
  pathOr,
  propOr,
  propSatisfies,
  toLower,
  toUpper
} from 'ramda'
import { createSelector } from 'reselect'

import { model, selectors } from 'data'

const { WALLET_TX_SEARCH } = model.form
const filterTransactions = curry((status, criteria, transactions) => {
  const isOfType = curry((filter, tx) =>
    propSatisfies(
      // @ts-ignore
      x => filter === '' || (x && toUpper(x) === toUpper(filter)),
      'type',
      tx
    )
  )
  const search = curry((text, txPath, tx) =>
    compose(includes(toUpper(text || '')), toUpper, String, path(txPath))(tx)
  )
  const searchPredicate = anyPass(
    map(search(criteria), [
      ['id'],
      ['description'],
      ['from'],
      ['to'],
      ['hash'],
      ['outputs', 0, 'address'],
      ['inputs', 0, 'address']
    ])
  )
  const fullPredicate = allPass([isOfType(status), searchPredicate])
  return filter(fullPredicate, transactions)
})

const coinSelectorMap = (state, coin, isCoinErc20) => {
  if (isCoinErc20) {
    return state =>
      selectors.core.common.eth.getErc20WalletTransactions(state, coin)
  }
  if (selectors.core.common[toLower(coin)]) {
    return selectors.core.common[toLower(coin)].getWalletTransactions
  }

  // default to fiat
  return state => selectors.core.data.fiat.getTransactions(coin, state)
}

export const getData = (state, coin, isCoinErc20) =>
  createSelector(
    [
      selectors.form.getFormValues(WALLET_TX_SEARCH),
      coinSelectorMap(state, coin, isCoinErc20),
      selectors.core.settings.getCurrency,
      () => selectors.core.walletOptions.getCoinModel(state, coin)
    ],
    (userSearch, pages: any, currencyR, coinModelR) => {
      const empty = page => isEmpty(page.data)
      const search = propOr('', 'search', userSearch)
      const status = propOr('', 'status', userSearch)
      const sourceType = pathOr('', ['source', 'type'], userSearch)
      const filteredPages =
        pages && !isEmpty(pages)
          ? pages.map(map(filterTransactions(status, search)))
          : []

      return {
        coinModel: coinModelR.getOrElse({}),
        currency: currencyR.getOrElse(''),
        hasTxResults: !all(empty)(filteredPages),
        // @ts-ignore
        isSearchEntered: search.length > 0 || status !== '',
        pages: filteredPages,
        sourceType
      }
    }
  )(state)
