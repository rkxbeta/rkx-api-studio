import { __ } from '@wordpress/i18n';

export interface ProPromotionSectionProps {
	proUrl?: string;
	compareUrl?: string;
}

export function ProPromotionSection( {
	proUrl,
	compareUrl,
}: ProPromotionSectionProps ) {
	if ( ! proUrl ) {
		return null;
	}

	const resolvedCompareUrl = compareUrl || proUrl;

	const freeComparisonItems = [
		__(
			'Create and manage standard REST API endpoints.',
			'rkx-api-studio'
		),
		__( 'Configure supported response data.', 'rkx-api-studio' ),
		__(
			'Use the existing Free authentication and formatting functionality.',
			'rkx-api-studio'
		),
	];

	const proComparisonItems = [
		__( 'Custom namespaces.', 'rkx-api-studio' ),
		__( 'Write operations.', 'rkx-api-studio' ),
		__( 'ACF / SCF integration.', 'rkx-api-studio' ),
		__( 'Gutenberg block parsing.', 'rkx-api-studio' ),
		__( 'Advanced Regex formatting.', 'rkx-api-studio' ),
		__( 'Named API keys.', 'rkx-api-studio' ),
	];

	return (
		<section
			className="rkx-as-pro-promo"
			aria-labelledby="rkx-as-pro-promo-heading"
		>
			<div className="rkx-as-pro-promo__hero">
				<div className="rkx-as-pro-promo__copy">
					<span className="rkx-as-pro-promo__eyebrow">
						{ __( 'RKX API Studio Pro Add-on', 'rkx-api-studio' ) }
					</span>
					<h3
						id="rkx-as-pro-promo-heading"
						className="rkx-as-pro-promo__title"
					>
						{ __(
							'Take Your WordPress APIs Further',
							'rkx-api-studio'
						) }
					</h3>
					<p className="rkx-as-pro-promo__description">
						{ __(
							'Extend RKX API Studio with advanced capabilities for custom REST API development, integrations, and authentication.',
							'rkx-api-studio'
						) }
					</p>
				</div>

				<div className="rkx-as-pro-promo__cta-group">
					<a
						className="components-button is-primary rkx-as-pro-promo__cta rkx-as-pro-promo__cta--primary"
						href={ proUrl }
						target="_blank"
						rel="noopener noreferrer"
					>
						{ __( 'Explore Pro Features', 'rkx-api-studio' ) }
						<span aria-hidden="true"> ↗</span>
					</a>
					<a
						className="components-button is-secondary rkx-as-pro-promo__cta rkx-as-pro-promo__cta--secondary"
						href={ resolvedCompareUrl }
						target="_blank"
						rel="noopener noreferrer"
					>
						{ __( 'Compare Free & Pro', 'rkx-api-studio' ) }
						<span aria-hidden="true"> ↗</span>
					</a>
				</div>
			</div>

			<div
				className="rkx-as-pro-promo__comparison"
				aria-labelledby="rkx-as-pro-comparison-heading"
			>
				<h4
					id="rkx-as-pro-comparison-heading"
					className="rkx-as-pro-promo__section-label"
				>
					{ __( 'Free vs Pro Overview', 'rkx-api-studio' ) }
				</h4>
				<div className="rkx-as-pro-promo__comparison-grid">
					<div className="rkx-as-pro-promo__tier rkx-as-pro-promo__tier--free">
						<div className="rkx-as-pro-promo__tier-header">
							<h5 className="rkx-as-pro-promo__tier-title">
								{ __( 'Free', 'rkx-api-studio' ) }
							</h5>
							<span className="rkx-as-pro-promo__tier-badge rkx-as-pro-promo__tier-badge--free">
								{ __( 'Included', 'rkx-api-studio' ) }
							</span>
						</div>
						<ul className="rkx-as-pro-promo__tier-list">
							{ freeComparisonItems.map( ( item ) => (
								<li
									key={ item }
									className="rkx-as-pro-promo__tier-item"
								>
									<span
										className="rkx-as-pro-promo__check"
										aria-hidden="true"
									>
										✓
									</span>
									<span>{ item }</span>
								</li>
							) ) }
						</ul>
					</div>

					<div className="rkx-as-pro-promo__tier rkx-as-pro-promo__tier--pro">
						<div className="rkx-as-pro-promo__tier-header">
							<h5 className="rkx-as-pro-promo__tier-title">
								{ __( 'Pro', 'rkx-api-studio' ) }
							</h5>
							<span className="rkx-as-pro-promo__tier-badge rkx-as-pro-promo__tier-badge--pro">
								{ __( 'Add-on', 'rkx-api-studio' ) }
							</span>
						</div>
						<ul className="rkx-as-pro-promo__tier-list">
							{ proComparisonItems.map( ( item ) => (
								<li
									key={ item }
									className="rkx-as-pro-promo__tier-item"
								>
									<span
										className="rkx-as-pro-promo__plus"
										aria-hidden="true"
									>
										+
									</span>
									<span>{ item }</span>
								</li>
							) ) }
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
