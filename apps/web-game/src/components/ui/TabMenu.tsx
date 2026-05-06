import React from "react";

import styles from "./TabMenu.module.css";

type TabMenuProps = {
	tabs: {
		label: string;
		content: React.ReactNode;
	}[];
	className?: string;
};

export function TabMenu({ tabs, className }: TabMenuProps) {
    const [activeTab, setActiveTab] = React.useState(0);

    return (
        <div className={`${styles.tabMenu} ${className ?? ""}`}>
            <ul className={styles.tabs}>
                {tabs.map((tab, index) => (
                    <li
                        key={index}
                        className={`${styles.tab} ${activeTab === index ? styles.active : ""}`}
                        onClick={() => setActiveTab(index)}
                    >
                        {tab.label}
                    </li>
                ))}
            </ul>
            <div className={styles.content}>{tabs[activeTab].content}</div>
        </div>
    );
}
