async function consumeVerifiedPurchase({ publisher, packageName, productId, purchaseToken }) {
  await publisher.purchases.products.consume({
    packageName,
    productId,
    token: purchaseToken,
  })
}

module.exports = { consumeVerifiedPurchase }
