import * as React from "react";

type IconProps = {
	className?: string;
	title?: string;
};

const SvgRoot: React.FC<
	React.PropsWithChildren<IconProps & { viewBox: string }>
> = ({ className, title, viewBox, children }) => (
	<svg
		className={className}
		viewBox={viewBox}
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		role="img"
		aria-hidden={title ? undefined : true}
	>
		{title ? <title>{title}</title> : null}
		{children}
	</svg>
);

export const TacticalAIRobotIcon: React.FC<IconProps> = ({
	className,
	title = "Robot",
}) => (
	<SvgRoot className={className} title={title} viewBox="0 0 64 64">
		<path
			d="M32 8V16"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinecap="round"
		/>
		<circle cx="32" cy="6" r="3" fill="currentColor" />
		<rect
			x="14"
			y="18"
			width="36"
			height="28"
			rx="9"
			stroke="currentColor"
			strokeWidth="3.5"
		/>
		<path
			d="M20 50V55M44 50V55M10 28H14M50 28H54"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinecap="round"
		/>
		<path
			d="M18 55H26M38 55H46"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinecap="round"
		/>
		<circle cx="25" cy="30" r="4.5" fill="currentColor" />
		<circle cx="39" cy="30" r="4.5" fill="currentColor" />
		<path
			d="M24 39H40"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinecap="round"
		/>
		<path
			d="M28 39V43M32 39V43M36 39V43"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			opacity="0.85"
		/>
	</SvgRoot>
);

export const TacticalAIBrainIcon: React.FC<IconProps> = ({
	className,
	title = "Brain",
}) => (
	<SvgRoot className={className} title={title} viewBox="0 0 64 64">
		<path
			d="M26 16C20.5 16 16 20.5 16 26C12.7 27.8 10.5 31.2 10.5 35.2C10.5 41.2 15.4 46 21.4 46H27.5V16H26Z"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinejoin="round"
		/>
		<path
			d="M38 16C43.5 16 48 20.5 48 26C51.3 27.8 53.5 31.2 53.5 35.2C53.5 41.2 48.6 46 42.6 46H36.5V16H38Z"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinejoin="round"
		/>
		<path
			d="M28 20C24.5 20 22 22.4 22 25.5C22 28.2 23.6 30 26 31.2M28 28C24.2 28 22 30.6 22 33.5C22 36.9 24.6 39.5 28 39.5"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
		/>
		<path
			d="M36 20C39.5 20 42 22.4 42 25.5C42 28.2 40.4 30 38 31.2M36 28C39.8 28 42 30.6 42 33.5C42 36.9 39.4 39.5 36 39.5"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
		/>
		<path
			d="M27.5 46V51C27.5 53.8 29.7 56 32.5 56C35.3 56 37.5 53.8 37.5 51V46"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M32 16V42"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
			opacity="0.9"
		/>
	</SvgRoot>
);
