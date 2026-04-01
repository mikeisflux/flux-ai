/**
 * Connector text block types for structured content blocks.
 */

export interface ConnectorTextBlock {
  type: 'connector_text'
  text: string
  connector_id?: string
}

export function isConnectorTextBlock(block: unknown): block is ConnectorTextBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as ConnectorTextBlock).type === 'connector_text'
  )
}
