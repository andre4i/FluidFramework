/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { WithStyles, createStyles, withStyles } from "@material-ui/core/styles";
import classNames from "classnames";

import * as React from "react";
import { SvgIcon } from "./SVGIcon.js";

import { iconHeight, iconMarginRight, iconWidth, unit } from "./constants.js";

const styles = () =>
	createStyles({
		row: {
			alignItems: "center",
			display: "flex",
			marginBottom: "5px",
		},
		svgIcon: {
			marginRight: `${iconMarginRight}${unit}`,
		},
	});

export interface INewDataRowProps {
	/**
	 * The data type to be added: Asset, Component or Property
	 */
	dataType: string;
}

class NewDataRow extends React.Component<INewDataRowProps & WithStyles<typeof styles>> {
	public render() {
		const { classes } = this.props;
		return (
			<div className={classNames(classes.row)}>
				<SvgIcon
					svgId={"plus-24"}
					height={iconHeight}
					width={iconWidth}
					className={classNames(classes.svgIcon)}
				/>
				New {this.props.dataType}...
			</div>
		);
	}
}

const styledNewDataRow = withStyles(styles, { name: "NewDataRow" })(NewDataRow);
export { styledNewDataRow as NewDataRow };
