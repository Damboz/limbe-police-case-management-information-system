import { useEffect } from 'react';


const SUFFIX = 'Police Case Management Information System';


export default function usePageTitle(title) {
    useEffect(() => {
        document.title = title ? `${title} | ${SUFFIX}` : SUFFIX;
    }, [title]);
}
