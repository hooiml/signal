// Shared by V8 Research browser checks: switch to a watchlist stock through the header Watchlist dialog.
// Desktop lists stocks as buttons; narrow widths show the "Selected watchlist stock" picker instead.
export async function switchWatchlistStock(page, value) {
    const [market, symbol] = value.split(':');
    await page.getByRole('button', { name: /^Watchlist · / }).click();
    const dialog = page.getByRole('dialog');
    const picker = dialog.getByLabel('Selected watchlist stock');
    if (await picker.isVisible()) {
        await picker.selectOption(value);
        return;
    }
    // Button text runs together with an aria-hidden monogram, so match the symbol and market lines on their own.
    await dialog.getByRole('region', { name: 'Saved watchlist' }).getByRole('button')
        .filter({ has: page.getByText(symbol, { exact: true }) })
        .filter({ has: page.getByText(new RegExp(`^${market}(?: · |$)`)) })
        .first().click();
}
