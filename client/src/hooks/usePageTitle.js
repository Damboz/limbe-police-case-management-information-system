import { useEffect } from 'react';


const SUFFIX = 'Limbe Police CMS';


export default function usePageTitle(title) {
    useEffect(() => {
        document.title = title ? `${title} | ${SUFFIX}` : SUFFIX;
    }, [title]);
}
